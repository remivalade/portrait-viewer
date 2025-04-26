// ----------------------------------------------------------
// Incremental Portrait sync with memoised CID check
// ----------------------------------------------------------

import fs         from 'fs';
import { ethers } from 'ethers';
import axios      from 'axios';

/*──────────────── CONFIG ────────────────*/
const RPC_URLS = [
  'https://sepolia.base.org',
  'https://1rpc.io/base-sepolia',
  'https://base-sepolia.blockpi.network/v1/rpc/public'
];
const CONTRACTS = {
  id      : '0x3cDc03BEb79ba3b9FD3b687C67BFDE70AFf46eBF',
  name    : '0xc788716466009AD7219c78d8e547819f6092ec8F',
  content : '0x320C9E64c9a68492A1EB830e64EE881D75ac5efd'
};
const PORTRAIT_API = 'https://api.portrait.so/api/v2/user/latestportrait?name=';
const PUBLIC_PAGE  = 'https://portrait.so/';
const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

const BATCH       = 500;   // on-chain lookup chunk
const BASE_WAIT   = 1_000; // ms
const GAP_MS      = 1_200; // steady API pace  (≈ 50/min)
/*────────────────────────────────────────*/

/*────────── util ──────────*/
const sleep = ms => new Promise(r => setTimeout(r, ms));

/*────────── load cache + meta ──────────*/
let portraits = [];
try { portraits = JSON.parse(fs.readFileSync('./backend/cache.json')); } catch {}
let meta = { highestIdSaved: 0, unpublishedIds: [], cidMap: {} };
try { meta = JSON.parse(fs.readFileSync('./backend/meta.json')); } catch {}

/*────────── RPC fail-over ──────────*/
async function rpc () {
  for (const url of RPC_URLS) {
    const p = new ethers.JsonRpcProvider(url, undefined, { timeout: 5_000 });
    try { await p.getNetwork(); console.log('🛰️  RPC', url); return p; }
    catch { console.warn('RPC down', url); }
  }
  throw new Error('No RPC reachable');
}
const provider = await rpc();

/*────────── contract ABIs (min.) ──────────*/
const idABI      = ['function portraitIdCounter() view returns(uint256)',
                    'function getOwnersForPortraitIds(uint256[] ids) view returns(address[] owners)'];
const nameABI    = ['function getNamesForPortraitIds(uint256[] ids) view returns(string[] names)'];
const contentABI = ['function portraitIdToPortraitHash(uint256 id) view returns(string)'];

const idC      = new ethers.Contract(CONTRACTS.id,      idABI,      provider);
const nameC    = new ethers.Contract(CONTRACTS.name,    nameABI,    provider);
const contentC = new ethers.Contract(CONTRACTS.content, contentABI, provider);

/*────────── graceful Ctrl+C ──────────*/
process.once('SIGINT', () => {
  fs.writeFileSync('./backend/cache.json', JSON.stringify(portraits, null, 2));
  fs.writeFileSync('./backend/meta.json',  JSON.stringify(meta,      null, 2));
  console.log('\n🛑  Partial data saved. Bye.');
  process.exit(0);
});

/*──────────────── MAIN ────────────────*/
(async () => {

  /* 1 . figure out which IDs we *might* need */
  const maxId = Number(await idC.portraitIdCounter());
  const newIds = [];
  for (let id = meta.highestIdSaved + 1; id <= maxId; id++) newIds.push(id);
  const candidateIds = newIds.concat(meta.unpublishedIds);
  if (!candidateIds.length) {
    console.log('✅  Nothing new to sync'); return;
  }
  console.log(`🔍  Checking ${candidateIds.length} candidate IDs`);

  /* 2 . owner filter */
  const idsWithOwner = [];
  for (let i = 0; i < candidateIds.length; i += BATCH) {
    const chunk   = candidateIds.slice(i, i + BATCH);
    const owners  = await idC.getOwnersForPortraitIds(chunk);
    owners.forEach((owner, j) => {
      if (owner !== ethers.ZeroAddress) idsWithOwner.push(chunk[j]);
    });
  }

  /* 3 . on-chain “published?” check */
  const publishedIds = [];
  const stillUnpub   = [];
  for (const id of idsWithOwner) {
    const hash = await contentC.portraitIdToPortraitHash(id);
    if (hash) publishedIds.push(id); else stillUnpub.push(id);
  }

  console.log(`🆕  ${publishedIds.length} published / ${stillUnpub.length} still unpublished`);

  /* 4 . usernames for published IDs */
  const usernames = await nameC.getNamesForPortraitIds(publishedIds);

  /* 5 . hit REST API *only if* CID is new */
  for (let i = 0; i < usernames.length; i++) {
    const id   = publishedIds[i];
    const user = usernames[i];
    if (!user) continue;

    const url = PORTRAIT_API + encodeURIComponent(user);
    let tries = 0;
    while (true) {
      const res = await axios.get(url, { timeout: 10_000, validateStatus: () => true });
      if (res.status === 429) {
        const wait = (res.headers['x-ratelimit-reset'] * 1000) - Date.now() + 1000;
        console.log(`⏳  429 – wait ${Math.ceil(wait/1000)}s`); await sleep(wait); continue;
      }
      if (res.status !== 200) { console.warn('skip', user, res.status); break; }

      const cid   = res.data?.settings?.profile?.avatar?.cid;
      const title = res.data?.settings?.profile?.title || user;
      if (!cid) break;

      /* memoisation: only update if CID changed or new ID */
      if (meta.cidMap[id] !== cid) {
        meta.cidMap[id] = cid;
        const obj = { id, username: title, imageUrl: IPFS_GATEWAY + cid,
                      profileUrl: PUBLIC_PAGE + user };
        portraits = portraits.filter(p => p.id !== id).concat(obj);
        console.log('⬆︎  saved', user);
      }
      break;
    }
    await sleep(GAP_MS);
  }

  /* 6 . write outputs */
  meta.highestIdSaved = maxId;
  meta.unpublishedIds = stillUnpub;
  fs.writeFileSync('./backend/cache.json', JSON.stringify(portraits, null, 2));
  fs.writeFileSync('./backend/meta.json',  JSON.stringify(meta,      null, 2));
  console.log(`✅  cache.json (${portraits.length}) & meta.json updated`);

})();
