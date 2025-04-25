// ----------------------------------------------------------
// backend/fetch-job.js   –  polite, resilient, fail-over ready
// ----------------------------------------------------------

// ‣ 0. DEPENDENCIES
import fs         from 'fs';
import { ethers } from 'ethers';
import axios      from 'axios';

// ‣ 1. SETTINGS  ────────────────────────────────────────────
const RPC_URLS = [
  'https://sepolia.base.org',                                 // primary
  'https://1rpc.io/base-sepolia',
  'https://base-sepolia.blockpi.network/v1/rpc/public'
];

const PORTRAIT_ID_REG   = '0x3cDc03BEb79ba3b9FD3b687C67BFDE70AFf46eBF';
const PORTRAIT_NAME_REG = '0xc788716466009AD7219c78d8e547819f6092ec8F';

const PORTRAIT_API      = 'https://api.portrait.so/api/v2/user/latestportrait?name=';
const PUBLIC_PAGE       = 'https://portrait.so/';
const IPFS_GATEWAY      = 'https://ipfs.io/ipfs/';

const FETCH_BATCH_SIZE  = 500;      // owner-lookup chunk
const REQUEST_GAP_MS    = 1_200;    // ≈ 50 calls / min (< 60 limit)
const MAX_TRIES         = 4;        // 1 + 3 retries
const BASE_DELAY_MS     = 1_000;    // back-off start
// ----------------------------------------------------------

// ‣ 2. RPC FAIL-OVER  ───────────────────────────────────────
async function getWorkingProvider () {
  for (const url of RPC_URLS) {
    const p = new ethers.JsonRpcProvider(url, undefined, { timeout: 5_000 });
    try {
      await p.getNetwork();           // lightweight probe
      console.log('🛰️   Connected to Base-Sepolia via', url);
      return p;
    } catch (e) {
      console.warn(`⚠️   RPC ${url} unreachable (${e.code || e.message})`);
    }
  }
  throw new Error('All RPC endpoints failed – check your network');
}

const provider = await getWorkingProvider();

// ‣ 3. CONTRACT INSTANCES  ─────────────────────────────────
const idABI   = [
  'function portraitIdCounter() view returns (uint256)',
  'function getOwnersForPortraitIds(uint256[] ids) view returns (address[] owners)'
];
const nameABI = [
  'function getNamesForPortraitIds(uint256[] ids) view returns (string[] names)'
];

const idContract   = new ethers.Contract(PORTRAIT_ID_REG,   idABI,   provider);
const nameContract = new ethers.Contract(PORTRAIT_NAME_REG, nameABI, provider);

// ‣ 4. SHARED HELPERS & SIGINT HANDLER  ────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

let portraits = [];   // so Ctrl+C can flush progress
process.once('SIGINT', () => {
  console.log('\n🛑  Ctrl+C – saving partial cache.json');
  try { fs.writeFileSync('./backend/cache.json', JSON.stringify(portraits, null, 2)); }
  catch (e) { console.error('Write failed:', e); }
  process.exit(0);
});

// ‣ 5. MAIN WORK  ───────────────────────────────────────────
async function main () {
  // 5.1  Discover active IDs
  const maxId = Number(await idContract.portraitIdCounter());
  console.log(`ℹ️   Highest issued ID: ${maxId}`);

  const activeIds = [];
  for (let from = 1; from <= maxId; from += FETCH_BATCH_SIZE) {
    const chunk  = Array.from({ length: Math.min(FETCH_BATCH_SIZE, maxId - from + 1) },
                              (_, i) => from + i);
    const owners = await idContract.getOwnersForPortraitIds(chunk);
    owners.forEach((owner, i) => {
      if (owner !== ethers.ZeroAddress) activeIds.push(chunk[i]);
    });
  }
  console.log(`⛏️   Found ${activeIds.length} active IDs`);

  if (!activeIds.length) {
    fs.writeFileSync('./backend/cache.json', '[]');
    console.warn('No portraits yet – cache written as empty array.');
    return;
  }

  // 5.2  Map IDs → usernames
  const usernames = await nameContract.getNamesForPortraitIds(activeIds);

  // 5.3  Loop through each username
  portraits = [];  // reset prog-tracker for SIGINT

  for (let idx = 0; idx < usernames.length; idx++) {
    const user = usernames[idx];
    if (!user) continue;             // blank handle

    // 5.3.a HEAD probe (cheap) to skip obvious unpublished handles
    try {
      const head = await axios.head(PUBLIC_PAGE + encodeURIComponent(user), {
        timeout: 5_000,
        validateStatus: () => true
      });
      if (head.status !== 200) {
        console.info(`ℹ️   No public page for “${user}” – skipped (HEAD ${head.status})`);
        continue;
      }
    } catch { /* network glitch → fall through to API call */ }

    // 5.3.b Portrait API call with adaptive retries / 429 handling
    let attempt = 0;
    while (attempt < MAX_TRIES) {
      try {
        const url = PORTRAIT_API + encodeURIComponent(user);
        const res = await axios.get(url, { timeout: 10_000, validateStatus: () => true });
        const { status, data, headers } = res;

        if (status === 429) {
          const resetUnix = Number(headers['x-ratelimit-reset']);
          const waitMs    = resetUnix ? resetUnix * 1000 - Date.now() + 1_000 : BASE_DELAY_MS;
          console.log(`⏳   429 – global limit. Sleeping ${Math.ceil(waitMs/1000)} s`);
          await sleep(waitMs);
          continue;                 // retry same user (doesn’t increment attempt)
        }

        if (status >= 500 && status < 600) {
          if (data?.message === 'This Portrait is not published') {
            console.info(`ℹ️   Unpublished “${user}” – skipped`);
            break;
          }
          if (++attempt < MAX_TRIES) {
            const wait = BASE_DELAY_MS * 2 ** (attempt - 1);
            console.log(`🔄   ${status} for “${user}” – retry in ${Math.ceil(wait/1000)} s`);
            await sleep(wait);
            continue;
          }
          console.warn(`⚠️   Skip “${user}” – kept returning ${status}`);
          break;
        }

        if (status !== 200) {
          console.warn(`⚠️   Skip “${user}” – API status ${status}`);
          break;
        }

        // SUCCESS
        const cid   = data?.settings?.profile?.avatar?.cid;
        const title = data?.settings?.profile?.title || user;
        if (cid) portraits.push({
          username   : title,
          imageUrl   : IPFS_GATEWAY + cid,
          profileUrl : PUBLIC_PAGE + user
        });
        break;

      } catch (err) {
        if (++attempt < MAX_TRIES) {
          const wait = BASE_DELAY_MS * 2 ** (attempt - 1);
          console.log(`🔄   Network error for “${user}” – retry in ${Math.ceil(wait/1000)} s`);
          await sleep(wait);
          continue;
        }
        console.warn(`⚠️   Skip “${user}” – ${err.message.slice(0, 80)}`);
        break;
      }
    }

    await sleep(REQUEST_GAP_MS);      // steady pace
    if (idx && idx % 200 === 0)
      console.log(`… ${idx}/${usernames.length} processed`);
  }

  // 5.4  Persist cache
  fs.writeFileSync('./backend/cache.json', JSON.stringify(portraits, null, 2));
  console.log(
    `✅   Done – ${portraits.length} published profiles saved ` +
    `(${usernames.length - portraits.length} skipped)`
  );
}

main().catch(e => { console.error(e); process.exit(1); });
