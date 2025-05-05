// ----------------------------------------------------------
// fetch-job.js — stable version (v4.0)
// Incremental Portrait sync with viem multicall & SQLite (Node ≥18 ESM)
// • Per‑portrait progress logs   • WAL + integrity‑check   • Full FTS rebuild
// • --limit / -l CLI arg and TEST_LIMIT env   • Works under Node v22
// ----------------------------------------------------------

import axios from 'axios';
import { createPublicClient, http, defineChain } from 'viem';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

//---------------------------------------------------------------------
// 1. Setup helpers
//---------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const sleep      = (ms) => new Promise(r => setTimeout(r, ms));
const dbPath     = path.resolve(__dirname, './portraits.sqlite');
const verboseSqlite3 = sqlite3.verbose();

//---------------------------------------------------------------------
// 2. CLI / env limit
//---------------------------------------------------------------------
const argv = process.argv.slice(2);
const limitIdx = argv.findIndex(a => a === '--limit' || a === '-l');
const argvLimit = limitIdx !== -1 ? +argv[limitIdx + 1] : 0;
const TEST_LIMIT = argvLimit || (+process.env.TEST_LIMIT || 0);

//---------------------------------------------------------------------
// 3. Chain config (Base‑Sepolia)
//---------------------------------------------------------------------
const RPC_URLS = [
  'https://sepolia.base.org',
  'https://1rpc.io/base-sepolia',
  'https://base-sepolia.blockpi.network/v1/rpc/public'
];

const BaseSepoliaChain = defineChain({
  id: 84531,
  name: 'Base Sepolia',
  network: 'base-sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: RPC_URLS } },
  contracts: { multicall3: { address: '0xca11bde05977b3631167028862be2a173976ca11', blockCreated: 11907934 } }
});

const CONTRACTS = {
  id:    '0x3cDc03BEb79ba3b9FD3b687C67BFDE70AFf46eBF',
  name:  '0xc788716466009AD7219c78d8e547819f6092ec8F',
  state: '0x320C9E64c9a68492A1EB830e64EE881D75ac5efd'
};

//---------------------------------------------------------------------
// 4. External constants
//---------------------------------------------------------------------
const PORTRAIT_API = 'https://api.portrait.so/api/v2/user/latestportrait?name=';
const PUBLIC_PAGE  = 'https://portrait.so/';
const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

//---------------------------------------------------------------------
// 5. Job constants
//---------------------------------------------------------------------
const BATCH    = 500;
const GAP_MS   = 1000;
const JOB_NAME = 'fetch-job';

//---------------------------------------------------------------------
// 6. SQLite helpers
//---------------------------------------------------------------------
function dbRun (db, sql, params = []) {
  return new Promise((resolve, reject) => db.run(sql, params, function (err) {
    if (err) reject(err); else resolve(this);
  }));
}
function dbGet (db, sql, params = []) {
  return new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
}

async function prepareDb () {
  const db = new verboseSqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);
  await dbRun(db, 'PRAGMA journal_mode=WAL;');
  const check = await dbGet(db, 'PRAGMA integrity_check;');
  if (check.integrity_check !== 'ok') {
    db.close();
    const bad = `${dbPath}.corrupt_${Date.now()}`;
    fs.renameSync(dbPath, bad);
    console.warn(`⚠️  DB corrupt → moved to ${bad}`);
    return prepareDb();
  }

  await dbRun(db, `CREATE TABLE IF NOT EXISTS portraits (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE,
    image_url TEXT,
    profile_url TEXT,
    image_arweave_tx TEXT,
    last_checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`);
  await dbRun(db, 'CREATE INDEX IF NOT EXISTS idx_username ON portraits(username);');

  await dbRun(db, `CREATE VIRTUAL TABLE IF NOT EXISTS portraits_fts USING fts5(
    username, content='portraits', content_rowid='id', tokenize='unicode61 remove_diacritics 2'
  );`);

  await dbRun(db, `CREATE TABLE IF NOT EXISTS job_status (
    job_name TEXT PRIMARY KEY,
    last_run_timestamp DATETIME,
    last_run_status TEXT,
    last_run_error TEXT,
    highest_id_processed INTEGER DEFAULT 0,
    unpublished_ids_json TEXT DEFAULT '[]'
  );`);

  return db;
}

//---------------------------------------------------------------------
// 7. Chain client (with fallback)
//---------------------------------------------------------------------
let cachedClient;
async function getClient () {
  if (cachedClient) return cachedClient;
  for (const url of RPC_URLS) {
    try {
      const client = createPublicClient({ chain: BaseSepoliaChain, transport: http(url) });
      await client.getBlockNumber();
      console.log(`🛰️  RPC OK → ${url}`);
      cachedClient = client;
      return client;
    } catch { console.warn(`⚠️  RPC failed → ${url}`); }
  }
  throw new Error('No working RPC found');
}

//---------------------------------------------------------------------
// 8. Job‑status helper
//---------------------------------------------------------------------
async function writeStatus (db, status, error = null, highest = 0, unpublished = []) {
  await dbRun(db, `INSERT INTO job_status
    (job_name,last_run_timestamp,last_run_status,last_run_error,highest_id_processed,unpublished_ids_json)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(job_name) DO UPDATE SET
      last_run_timestamp   = excluded.last_run_timestamp,
      last_run_status      = excluded.last_run_status,
      last_run_error       = excluded.last_run_error,
      highest_id_processed = excluded.highest_id_processed,
      unpublished_ids_json = excluded.unpublished_ids_json`,
    [JOB_NAME, new Date().toISOString(), status, error, highest, JSON.stringify(unpublished)]);
}

//---------------------------------------------------------------------
// 9. Main job
//---------------------------------------------------------------------
async function runJob () {
  const db = await prepareDb();

  // restore checkpoint
  const prev = await dbGet(db, 'SELECT highest_id_processed, unpublished_ids_json FROM job_status WHERE job_name=?', [JOB_NAME]) || {};
  const state = {
    highest: prev.highest_id_processed || 0,
    unpublished: (() => { try { return JSON.parse(prev.unpublished_ids_json || '[]'); } catch { return []; } })()
  };
  console.log(`ℹ️  Cursor: highest=${state.highest} unpublished=${state.unpublished.length}`);
  await writeStatus(db, 'running');

  let maxIdOnChain = 0;
  try {
    const client = await getClient();

    // 1️⃣ counter
    maxIdOnChain = Number(await client.readContract({
      address: CONTRACTS.id,
      abi: [{ inputs: [], name: 'portraitIdCounter', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }],
      functionName: 'portraitIdCounter'
    }));
    console.log(`ℹ️  Counter on-chain: ${maxIdOnChain}`);

    const upper = TEST_LIMIT ? Math.min(TEST_LIMIT, maxIdOnChain) : maxIdOnChain;
    if (TEST_LIMIT) console.log(`⚠️  Limit=${TEST_LIMIT}`);

    const freshIds = Array.from({ length: Math.max(0, upper - state.highest) }, (_, i) => state.highest + 1 + i);
    const candidates = Array.from(new Set([...freshIds, ...state.unpublished.filter(id => id <= upper)])).sort((a,b)=>a-b);
    if (!candidates.length) {
      console.log('✅ Nothing new.');
      await writeStatus(db, 'success', null, maxIdOnChain, state.unpublished);
      return;
    }
    console.log(`🔍  Candidates ${candidates.length} (${candidates[0]}‑${candidates[candidates.length-1]})`);

    // 2️⃣ check published
    const stateAbi = [{ inputs:[{name:'id',type:'uint256'}], name:'portraitIdToPortraitHash', outputs:[{type:'string'}], stateMutability:'view', type:'function' }];
    const published = [];
    const stillUnpub = new Set();
    for (let i=0;i<candidates.length;i+=BATCH) {
      const chunk = candidates.slice(i, i+BATCH);
      const res = await client.multicall({ contracts: chunk.map(id=>({ address:CONTRACTS.state, abi:stateAbi, functionName:'portraitIdToPortraitHash', args:[BigInt(id)] })), allowFailure:true });
      res.forEach((r, idx) => {
        const id = chunk[idx];
        (r.status==='success' && r.result && r.result.trim()!=='0x' && r.result.trim()!=='') ? published.push(id) : stillUnpub.add(id);
      });
      if (candidates.length>BATCH) await sleep(50);
    }
    console.log(`🔗  Published ${published.length} / Unpublished ${stillUnpub.size}`);
    if (!published.length) {
      await writeStatus(db, 'success', null, maxIdOnChain, Array.from(stillUnpub));
      return;
    }

    // 3️⃣ usernames (batch)
    const nameAbi = [{ inputs:[{internalType:'uint256[]',name:'portraitIds',type:'uint256[]'}], name:'getNamesForPortraitIds', outputs:[{internalType:'string[]',name:'names',type:'string[]'}], stateMutability:'view', type:'function' }];
    const idToUser = {};
    for (let i=0;i<published.length;i+=BATCH) {
      const chunk = published.slice(i, i+BATCH);
      const mc = await client.multicall({ contracts:[{ address:CONTRACTS.name, abi:nameAbi, functionName:'getNamesForPortraitIds', args:[chunk.map(n=>BigInt(n))] }], allowFailure:false });
      const namesArr = Array.isArray(mc[0]) ? mc[0] : mc[0]?.result || [];
      namesArr.forEach((name, idx) => { if(name) idToUser[chunk[idx]] = name; });
      if (published.length>BATCH) await sleep(50);
    }
    console.log(`👤  Usernames ${Object.keys(idToUser).length}`);

    // 4️⃣ enrich + persist
    const rows = [];
    const entries = Object.entries(idToUser);
    for (let i=0;i<entries.length;i++) {
      const [id, handle] = entries[i];
      let cid=null, arTx=null, title=handle;
      try {
        const r = await axios.get(`${PORTRAIT_API}${encodeURIComponent(handle)}`, { timeout:20000, validateStatus:s=>s===200 });
        const avatar = r.data?.settings?.profile?.avatar;
        cid  = avatar?.cid || null;
        arTx = avatar?.arweaveTxId || null;
        const ttl = r.data?.settings?.profile?.title;
        if (typeof ttl==='string' && ttl.trim()) title = ttl.replace(/<[^>]*>/g,'').trim();
      } catch {}
      console.log(`   ↳ (${i+1}/${entries.length}) ${handle.padEnd(20)} | cid:${cid?'✔':'·'} ar:${arTx?'✔':'·'} `);
      rows.push({ id:+id, username:title, image_url: cid?`${IPFS_GATEWAY}${cid}`:null, profile_url:`${PUBLIC_PAGE}${handle}`, image_arweave_tx: arTx?`https://irys.portrait.host/${arTx}`:null });
      await sleep(GAP_MS);
    }

    if (rows.length) {
      await new Promise((resolve,reject)=>{
        db.serialize(()=>{
          db.run('BEGIN;');
          const stmt = db.prepare('INSERT OR REPLACE INTO portraits (id,username,image_url,profile_url,image_arweave_tx,last_checked_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)');
          rows.forEach(r=>stmt.run([r.id,r.username,r.image_url,r.profile_url,r.image_arweave_tx]));
          stmt.finalize();
          db.run('COMMIT;', err=>err?reject(err):resolve());
        });
      });
      await dbRun(db, `INSERT INTO portraits_fts(portraits_fts) VALUES('rebuild');`);
      console.log(`💾  Saved ${rows.length} rows.`);
    }

    await writeStatus(db, 'success', null, maxIdOnChain, Array.from(stillUnpub));
    console.log('🏁  Done → success');
  } catch (err) {
    console.error('❌  Error:', err.message || err);
    await writeStatus(db, 'error', err.message || String(err), maxIdOnChain, state.unpublished).catch(console.error);
  } finally {
    db.close();
  }
}

//---------------------------------------------------------------------
// 10. Run when executed directly
//---------------------------------------------------------------------
if (import.meta.url === `file://${__filename}`) {
  runJob().catch(e => { console.error('Fatal', e); process.exit(1); });
}
