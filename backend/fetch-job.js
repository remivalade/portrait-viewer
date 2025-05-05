// ----------------------------------------------------------
// fetch-job.js — stable version (v5.1)
// Incremental Portrait sync with viem multicall & SQLite (Node ≥18 ESM)
// ----------------------------------------------------------
//  • Registers **all** portrait IDs (published or not)
//  • Stores on‑chain state hash, publication flag & owner address
//  • Keeps username (if any) and enriches with Portrait API (CID, Arweave, title)
//  • WAL mode, integrity‑check, full FTS rebuild
//  • CLI flags   --limit/-l   and   --refresh-all/-R
// ----------------------------------------------------------

import axios from 'axios';
import { createPublicClient, http, defineChain } from 'viem';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

//---------------------------------------------------------------------
// 1.   Helpers / constants
//---------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const sleep      = (ms)=> new Promise(r=>setTimeout(r,ms));
const dbPath     = path.resolve(__dirname,'./portraits.sqlite');
const verboseSqlite3 = sqlite3.verbose();

//---------------------------------------------------------------------
// 2.   CLI & ENV options
//---------------------------------------------------------------------
const argv = process.argv.slice(2);
const pickFlag = (long, short)=>{
  const idx = argv.findIndex(a=>a===long||a===short);
  return idx!==-1 ? {idx,val:argv[idx+1]} : null;
};
const limitOpt   = pickFlag('--limit','-l');
const windowOpt  = pickFlag('--window','-w');   // optional: look‑back N ids
const refreshAll = argv.includes('--refresh-all') || argv.includes('-R');

const TEST_LIMIT = limitOpt? +limitOpt.val : (+process.env.TEST_LIMIT||0);
const WINDOW_N   = windowOpt? +windowOpt.val  : 0;

//---------------------------------------------------------------------
// 3.   Chain config (Base‑Sepolia)
//---------------------------------------------------------------------
const RPC_URLS=[
  'https://sepolia.base.org',
  'https://1rpc.io/base-sepolia',
  'https://base-sepolia.blockpi.network/v1/rpc/public'
];

const BaseSepoliaChain = defineChain({
  id:84531,
  name:'Base Sepolia',
  network:'base-sepolia',
  nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},
  rpcUrls:{default:{http:RPC_URLS}},
  contracts:{multicall3:{address:'0xca11bde05977b3631167028862be2a173976ca11',blockCreated:11907934}}
});

const CONTRACTS={
  id:   '0x3cDc03BEb79ba3b9FD3b687C67BFDE70AFf46eBF',
  name: '0xc788716466009AD7219c78d8e547819f6092ec8F',
  state:'0x320C9E64c9a68492A1EB830e64EE881D75ac5efd'
};

//---------------------------------------------------------------------
// 4.   External services
//---------------------------------------------------------------------
const PORTRAIT_API='https://api.portrait.so/api/v2/user/latestportrait?name=';
const PUBLIC_PAGE ='https://portrait.so/';
const IPFS_GATEWAY='https://ipfs.io/ipfs/';
const IRYS_GATEWAY='https://irys.portrait.host/';

//---------------------------------------------------------------------
// 5.   Job constants
//---------------------------------------------------------------------
const BATCH=500;
const GAP_MS=1000;
const JOB_NAME='fetch-job';

//---------------------------------------------------------------------
// 6.   SQLite helpers
//---------------------------------------------------------------------
function dbRun(db,sql,params=[]) {
  return new Promise((res,rej)=>db.run(sql,params,function(err){err?rej(err):res(this);}));
}
function dbGet(db,sql,params=[]) {
  return new Promise((res,rej)=>db.get(sql,params,(err,row)=>err?rej(err):res(row)));}

async function prepareDb(){
  const db=new verboseSqlite3.Database(dbPath,sqlite3.OPEN_READWRITE|sqlite3.OPEN_CREATE);
  await dbRun(db,'PRAGMA journal_mode=WAL;');
  const chk=await dbGet(db,'PRAGMA integrity_check;');
  if(chk.integrity_check!=='ok'){
    db.close();
    const bad=`${dbPath}.corrupt_${Date.now()}`;
    fs.renameSync(dbPath,bad);
    console.warn(`⚠️  DB corrupt → moved to ${bad}`);
    return prepareDb();
  }
  await dbRun(db,`CREATE TABLE IF NOT EXISTS portraits (
    id              INTEGER PRIMARY KEY,
    username        TEXT,
    owner_address   TEXT,
    state_hash      TEXT,
    is_published    INTEGER DEFAULT 0,
    image_url       TEXT,
    profile_url     TEXT,
    image_arweave_tx TEXT,
    last_checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(id)
  );`);
  await dbRun(db,'CREATE INDEX IF NOT EXISTS idx_username ON portraits(username);');
  await dbRun(db,'CREATE INDEX IF NOT EXISTS idx_owner ON portraits(owner_address);');
  await dbRun(db,'CREATE INDEX IF NOT EXISTS idx_published ON portraits(is_published);');

  await dbRun(db,`CREATE VIRTUAL TABLE IF NOT EXISTS portraits_fts USING fts5(
      username, content='portraits', content_rowid='id', tokenize='unicode61 remove_diacritics 2'
  );`);

  await dbRun(db,`CREATE TABLE IF NOT EXISTS job_status (
    job_name TEXT PRIMARY KEY,
    last_run_timestamp DATETIME,
    last_run_status TEXT,
    last_run_error TEXT,
    highest_id_processed INTEGER DEFAULT 0
  );`);
  return db;
}

//---------------------------------------------------------------------
// 7.   Chain client
//---------------------------------------------------------------------
let cachedClient;
async function getClient(){
  if(cachedClient) return cachedClient;
  for(const url of RPC_URLS){
    try{
      const client=createPublicClient({chain:BaseSepoliaChain,transport:http(url)});
      await client.getBlockNumber();
      console.log(`🛰️  RPC OK → ${url}`);
      cachedClient=client;
      return client;
    }catch{console.warn(`⚠️  RPC failed → ${url}`);} }
  throw new Error('No working RPC');
}

//---------------------------------------------------------------------
// 8.   Job‑status helper
//---------------------------------------------------------------------
async function writeStatus(db,status,error=null,highest=0){
  await dbRun(db,`INSERT INTO job_status (job_name,last_run_timestamp,last_run_status,last_run_error,highest_id_processed)
    VALUES (?,?,?,?,?)
    ON CONFLICT(job_name) DO UPDATE SET
      last_run_timestamp=excluded.last_run_timestamp,
      last_run_status   =excluded.last_run_status,
      last_run_error    =excluded.last_run_error,
      highest_id_processed=excluded.highest_id_processed`,
    [JOB_NAME,new Date().toISOString(),status,error?String(error).slice(0,1000):null,highest]);
}

//---------------------------------------------------------------------
// 9.   Main job
//---------------------------------------------------------------------
async function runJob(){
  const db=await prepareDb();
  const prev=await dbGet(db,'SELECT highest_id_processed FROM job_status WHERE job_name=?',[JOB_NAME])||{};
  let cursor=prev.highest_id_processed||0;
  if(refreshAll){
    console.log('⚠️  --refresh-all set – starting from ID 0');
    cursor=0;
  }
  console.log(`ℹ️  Cursor: highest=${cursor}`);
  await writeStatus(db,'running',null,cursor);

  let maxIdOnChain=0;
  try{
    const client=await getClient();
    maxIdOnChain=Number(await client.readContract({
      address:CONTRACTS.id,
      abi:[{inputs:[],name:'portraitIdCounter',outputs:[{type:'uint256'}],stateMutability:'view',type:'function'}],
      functionName:'portraitIdCounter'}));
    console.log(`ℹ️  Counter on-chain: ${maxIdOnChain}`);

    // Determine scan window
    let upper=maxIdOnChain;
    if(TEST_LIMIT) upper=Math.min(upper,TEST_LIMIT);
    if(WINDOW_N>0) upper=maxIdOnChain, cursor=Math.max(0,maxIdOnChain-WINDOW_N);
    console.log(`🔍  Scan range: ${cursor+1} → ${upper}`);
    if(upper<=cursor){
      console.log('✅ Nothing new.');
      await writeStatus(db,'success',null,maxIdOnChain);
      return db.close();
    }

    const candidateIds=Array.from({length:upper-cursor},(_,i)=>cursor+1+i);

    // ===== 1. On‑chain multicall =====
    const stateAbi=[{inputs:[{name:'id',type:'uint256'}],name:'portraitIdToPortraitHash',outputs:[{type:'string'}],stateMutability:'view',type:'function'}];
    const ownerAbi=[{inputs:[{type:'uint256'}],name:'portraitIdToOwner',outputs:[{type:'address'}],stateMutability:'view',type:'function'}];
    const nameBatchAbi=[{inputs:[{internalType:'uint256[]',name:'portraitIds',type:'uint256[]'}],name:'getNamesForPortraitIds',outputs:[{internalType:'string[]',name:'names',type:'string[]'}],stateMutability:'view',type:'function'}];

    // Get stateHash & owner per ID (batch 500 *2 calls)
    const chainData={};
    for(let i=0;i<candidateIds.length;i+=BATCH){
      const chunk=candidateIds.slice(i,i+BATCH);
      const calls=[
        ...chunk.map(id=>({address:CONTRACTS.state,abi:stateAbi,functionName:'portraitIdToPortraitHash',args:[BigInt(id)]})),
        ...chunk.map(id=>({address:CONTRACTS.id,abi:ownerAbi,functionName:'portraitIdToOwner',args:[BigInt(id)]}))
      ];
      const res=await client.multicall({contracts:calls,allowFailure:true});
      // first half are state hashes
      for(let j=0;j<chunk.length;j++){
        const id=chunk[j];
        const stateRes=res[j];
        const ownerRes=res[j+chunk.length];
        const stateHash=(stateRes.status==='success' && typeof stateRes.result==='string')?stateRes.result.trim():null;
        const ownerAddr=(ownerRes.status==='success' && typeof ownerRes.result==='string' && ownerRes.result!=='0x0000000000000000000000000000000000000000')?ownerRes.result:null;
        chainData[id]={stateHash,ownerAddr};
      }
      if(candidateIds.length>BATCH) await sleep(50);
    }

    // Batch fetch usernames for ALL candidate IDs
    const usernames={};
    for(let i=0;i<candidateIds.length;i+=BATCH){
      const chunk=candidateIds.slice(i,i+BATCH);
      const r=await client.multicall({contracts:[{address:CONTRACTS.name,abi:nameBatchAbi,functionName:'getNamesForPortraitIds',args:[chunk.map(n=>BigInt(n))]}],allowFailure:false});
      const arr=Array.isArray(r[0])?r[0]:r[0]?.result||[];
      arr.forEach((name,idx)=>{if(name) usernames[chunk[idx]]=name;});
      if(candidateIds.length>BATCH) await sleep(50);
    }

    // ===== 2. API enrichment =====
    const portraitsToSave=[];
    let count=0;
    for(const id of candidateIds){
      count++;
      const username=usernames[id]||null;
      const owner=chainData[id]?.ownerAddr||null;
      const stateHash=chainData[id]?.stateHash||null;
      const isPublished=stateHash && stateHash!=='' && stateHash!=='0x'?1:0;
      let title=username;
      let cid=null,arTx=null;
      if(username){
        try{
          const apiRes=await axios.get(`${PORTRAIT_API}${encodeURIComponent(username)}`,{timeout:20000,validateStatus:s=>s===200});
          const avatar=apiRes.data?.settings?.profile?.avatar;
          cid=avatar?.cid||null;
          arTx=avatar?.arweaveTxId||null;
          const apiTitle=apiRes.data?.settings?.profile?.title;
          if(apiTitle && apiTitle.trim()) title=apiTitle.replace(/<[^>]*>/g,'').trim();
        }catch{ /* ignore api error */ }
      }
      const imgUrl=cid?`${IPFS_GATEWAY}${cid}`:null;
      const arUrl=arTx?`${IRYS_GATEWAY}${arTx}`:null;
      const profileUrl=username?`${PUBLIC_PAGE}${encodeURIComponent(username)}`:null;

      console.log(`   ↳ (${count}/${candidateIds.length}) id:${id} usr:${username||'·'} pub:${isPublished?'✔':'·'}`);

      portraitsToSave.push({id,username:title||null,owner_address:owner,state_hash:stateHash,is_published:isPublished,image_url:imgUrl,profile_url:profileUrl,image_arweave_tx:arUrl});
      await sleep(GAP_MS);
    }

    // ===== 3. Persist =====
    if(portraitsToSave.length){
      await new Promise((resolve,reject)=>{
        db.serialize(()=>{
          db.run('BEGIN;');
          const stmt=db.prepare(`INSERT OR REPLACE INTO portraits
              (id,username,owner_address,state_hash,is_published,image_url,profile_url,image_arweave_tx,last_checked_at)
              VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP);`);
          portraitsToSave.forEach(r=>stmt.run([r.id,r.username,r.owner_address,r.state_hash,r.is_published,r.image_url,r.profile_url,r.image_arweave_tx]));
          stmt.finalize();
          db.run(`INSERT INTO portraits_fts(portraits_fts) VALUES('rebuild');`);
          db.run('COMMIT;', err => {
            if (err) return reject(err);
          db.run('PRAGMA wal_checkpoint(TRUNCATE);', err2 =>
            err2 ? reject(err2) : resolve()
        );
      });
    });
  });
      console.log(`💾  Saved ${portraitsToSave.length} rows.`);
    }

    await writeStatus(db,'success',null,upper);
    console.log('🏁  Done → success');
  }catch(err){
    console.error('❌  Error:',err.message||err);
    await writeStatus(db,'error',err.message||String(err),maxIdOnChain||cursor).catch(console.error);
  }finally{
    db.close();
  }
}

//---------------------------------------------------------------------
// 10. Execute when run directly
//---------------------------------------------------------------------
if(import.meta.url===`file://${__filename}`){
  runJob().catch(e=>{console.error('Fatal',e);process.exit(1);});
}
