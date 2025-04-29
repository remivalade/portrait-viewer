// ----------------------------------------------------------
// Incremental Portrait sync with viem multicall & SQLite
// ----------------------------------------------------------

import axios from 'axios';
import { createPublicClient, http } from 'viem';
import sqlite3 from 'sqlite3';
import path from 'path';

// --- Configuration ---
const RPC_URLS = [
  'https://sepolia.base.org',
  'https://1rpc.io/base-sepolia',
  'https://base-sepolia.blockpi.network/v1/rpc/public'
];

const BaseSepoliaChain = {
  id: 84531, name: 'Base Sepolia', network: 'base-sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: RPC_URLS } },
  contracts: { multicall3: { address: '0xca11bde05977b3631167028862be2a173976ca11', blockCreated: 11907934 } }
};

const CONTRACTS = {
  id:    '0x3cDc03BEb79ba3b9FD3b687C67BFDE70AFf46eBF', // PortraitIdRegistryV2
  name:  '0xc788716466009AD7219c78d8e547819f6092ec8F', // PortraitNameRegistry
  state: '0x320C9E64c9a68492A1EB830e64EE881D75ac5efd'  // PortraitStateRegistry
};

const PORTRAIT_API  = 'https://api.portrait.so/api/v2/user/latestportrait?name=';
const PUBLIC_PAGE   = 'https://portrait.so/';
const IPFS_GATEWAY  = 'https://ipfs.io/ipfs/';

const BATCH    = 500;   // size of on-chain multicall chunks
const GAP_MS   = 1000;  // throttle API requests (~60/min)

const dbPath = path.resolve('./backend/portraits.sqlite');
const JOB_NAME = 'fetch-job'; // Used as key in job_status table

const sleep = ms => new Promise(r => setTimeout(r, ms));

// --- Database Setup ---
const verboseSqlite3 = sqlite3.verbose();
const db = new verboseSqlite3.Database(dbPath, async (err) => {
  if (err) {
    console.error(`❌ Fatal: Could not connect to database ${dbPath}:`, err.message);
    process.exit(1);
  } else {
    console.log(`✅ Connected to SQLite database: ${dbPath}`);
    try {
      await initializeDb();
      await runFetchJob();
    } catch (initErr) {
        console.error(`❌ Fatal: Database initialization failed:`, initErr);
        closeDbAndExit(1);
    }
  }
});

function initializeDb() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS portraits (
          id INTEGER PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          image_url TEXT,
          profile_url TEXT NOT NULL,
          last_checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) return reject(new Error(`Error creating portraits table: ${err.message}`));
        console.log("✅ 'portraits' table ensured.");
      });
      db.run(`
        CREATE TABLE IF NOT EXISTS job_status (
          job_name TEXT PRIMARY KEY,
          last_run_timestamp DATETIME,
          last_run_status TEXT,
          last_run_error TEXT,
          highest_id_processed INTEGER DEFAULT 0,
          unpublished_ids_json TEXT DEFAULT '[]',
          cid_map_json TEXT DEFAULT '{}'
        )
      `, (err) => {
        if (err) return reject(new Error(`Error creating job_status table: ${err.message}`));
        console.log("✅ 'job_status' table ensured.");
        resolve();
      });
    });
  });
}

function updateJobStatus(status, error = null, highestId = null, unpublishedIds = null, cidMap = null) {
  // ... (updateJobStatus function remains unchanged) ...
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT OR REPLACE INTO job_status
      (job_name, last_run_timestamp, last_run_status, last_run_error, highest_id_processed, unpublished_ids_json, cid_map_json)
      VALUES (?, ?, ?, ?,
        COALESCE(?, (SELECT highest_id_processed FROM job_status WHERE job_name = ?)),
        COALESCE(?, (SELECT unpublished_ids_json FROM job_status WHERE job_name = ?)),
        COALESCE(?, (SELECT cid_map_json FROM job_status WHERE job_name = ?))
      )
    `;
    const params = [
      JOB_NAME, new Date().toISOString(), status,
      error ? String(error).substring(0, 1000) : null,
      highestId, JOB_NAME,
      unpublishedIds !== null ? JSON.stringify(unpublishedIds) : null, JOB_NAME,
      cidMap !== null ? JSON.stringify(cidMap) : null, JOB_NAME
    ];
    const timeout = setTimeout(() => { reject(new Error('Database update job status timed out after 10 seconds')); }, 10000);
    db.run(sql, params, function(err) {
       clearTimeout(timeout);
      if (err) {
        console.error("❌ Error updating job status:", err.message);
        console.error("   Status being set:", status);
        console.error("   Params:", JSON.stringify(params.slice(0, 4)));
        reject(err);
      } else {
        console.log(`💾 Job status updated: ${status}.`);
        resolve();
      }
    });
  });
}

async function getClient() {
  // ... (getClient function remains unchanged) ...
  for (const url of RPC_URLS) {
    const client = createPublicClient({ chain: BaseSepoliaChain, transport: http(url, { timeout: 15000 }) });
    try { await client.getBlockNumber({ maxAge: 0 }); console.log('🛰️  RPC OK →', url); return client; }
    catch (err) { console.warn(`RPC down → ${url} (${err.message})`); }
  }
  throw new Error('No RPC reachable');
}

function closeDbAndExit(exitCode = 0) {
  // ... (closeDbAndExit function remains unchanged) ...
    db.close((err) => {
      if (err) { console.error('❌ Error closing database connection:', err.message); }
      else { console.log('ℹ️ Database connection closed.'); }
      process.exit(exitCode);
    });
}

// --- Main Fetch Logic Wrapped in a Function ---
async function runFetchJob() {
  let currentStatus = { highestIdSaved: 0, unpublishedIds: [], cidMap: {} };
  let maxIdOnChain = 0;
  let overallStatus = 'running'; // Default to running
  let overallError = null;
  // Removed: let usernameFetchFailed = false;

  try {
    await updateJobStatus('running'); // Mark job as running

    const row = await new Promise((resolve, reject) => {
        db.get(`SELECT highest_id_processed, unpublished_ids_json, cid_map_json FROM job_status WHERE job_name = ?`, [JOB_NAME], (err, row) => {
            if (err) reject(err); else resolve(row || null);
        });
    });
    if (row) {
        currentStatus.highestIdSaved = row.highest_id_processed || 0;
        try { currentStatus.unpublishedIds = JSON.parse(row.unpublished_ids_json || '[]'); } catch (e) { console.warn("⚠️ Couldn't parse unpublished_ids_json, starting fresh."); currentStatus.unpublishedIds = []; }
        try { currentStatus.cidMap = JSON.parse(row.cid_map_json || '{}'); } catch (e) { console.warn("⚠️ Couldn't parse cid_map_json, starting fresh."); currentStatus.cidMap = {}; }
        console.log(`ℹ️ Loaded state: highestId=${currentStatus.highestIdSaved}, unpublished=${currentStatus.unpublishedIds.length}, cidMap entries=${Object.keys(currentStatus.cidMap).length}`);
    } else {
        console.log("ℹ️ No previous state found in DB (or failed to load), starting fresh.");
        currentStatus = { highestIdSaved: 0, unpublishedIds: [], cidMap: {} };
    }

    const client = await getClient();

    maxIdOnChain = Number(
      await client.readContract({ /* ... ID counter contract call ... */
        address: CONTRACTS.id,
        abi: [ { "inputs": [], "name": "portraitIdCounter", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" } ],
        functionName: 'portraitIdCounter'
       })
    );
    const newIds = [];
    const startId = Number(currentStatus.highestIdSaved) || 0;
    for (let i = startId + 1; i <= maxIdOnChain; i++) { newIds.push(i); }
    const unpublished = Array.isArray(currentStatus.unpublishedIds) ? currentStatus.unpublishedIds : [];
    const candidateIds = Array.from(new Set(newIds.concat(unpublished)));

    if (candidateIds.length === 0 && maxIdOnChain === startId) { /* ... No sync needed logic ... */
      console.log('✅  Nothing new to sync.');
      overallStatus = 'success';
      await updateJobStatus(overallStatus, null, maxIdOnChain, currentStatus.unpublishedIds, currentStatus.cidMap);
      closeDbAndExit(0); return;
    }
    console.log(`🔍  Checking ${candidateIds.length} candidate IDs (up to ${maxIdOnChain})`);

    const idsToCheckState = candidateIds;
    console.log(`ℹ️  Proceeding to check state for ${idsToCheckState.length} IDs.`);

    // --- State Check (unchanged) ---
    const publishedIds = [];
    const tempUnpublished = [];
    for (let i = 0; i < idsToCheckState.length; i += BATCH) { /* ... State check loop ... */
      const chunk = idsToCheckState.slice(i, i + BATCH);
      console.log(`    Pinging state for IDs ${chunk[0]} to ${chunk[chunk.length - 1]}...`);
      const hashesResults = await client.multicall({ contracts: chunk.map(id => ({ /* ... state contract config ... */
          address: CONTRACTS.state,
          abi: [ { "inputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "name": "portraitIdToPortraitHash", "outputs": [ { "internalType": "string", "name": "", "type": "string" } ], "stateMutability": "view", "type": "function" } ],
          functionName: 'portraitIdToPortraitHash',
          args: [BigInt(id)]
       })), allowFailure: true });
      hashesResults.forEach((resultObj, idx) => { const currentId = chunk[idx]; if (resultObj?.status === 'success') { if (resultObj.result && resultObj.result !== '0x' && resultObj.result !== '') { publishedIds.push(currentId); } else { tempUnpublished.push(currentId); } } else { console.error(`   ⚠️ Error checking state for ID ${currentId}: ${resultObj?.error?.shortMessage || 'Unknown error'}`); tempUnpublished.push(currentId); } });
      await sleep(100);
    }
    const currentUnpublishedSet = new Set(tempUnpublished);
    const previousUnpublished = Array.isArray(currentStatus.unpublishedIds) ? currentStatus.unpublishedIds : [];
    const finalUnpublishedIds = Array.from(new Set( previousUnpublished.filter(id => currentUnpublishedSet.has(id)).concat(tempUnpublished) ));
    console.log(`🔎 State check done: ${publishedIds.length} published / ${finalUnpublishedIds.length} considered unpublished.`);
    currentStatus.unpublishedIds = finalUnpublishedIds;

    // --- Username Fetching ---
    let usernamesMap = {};
    if (publishedIds.length > 0) {
        console.log(`👤 Fetching usernames for ${publishedIds.length} published IDs...`)
        for (let i = 0; i < publishedIds.length; i += BATCH) {
            const chunk = publishedIds.slice(i, i + BATCH);
            try {
                const usernamesResults = await client.multicall({
                    contracts: [{
                      address: CONTRACTS.name,
                      abi: [ { "inputs": [ { "internalType": "uint256[]", "name": "portraitIds", "type": "uint256[]" } ], "name": "getNamesForPortraitIds", "outputs": [ { "internalType": "string[]", "name": "names", "type": "string[]" } ], "stateMutability": "view", "type": "function" } ],
                      functionName: 'getNamesForPortraitIds',
                      args: [chunk.map(id => BigInt(id))]
                    }],
                    allowFailure: false // Keep this - if the node truly fails, we want an error
                });

                // *** CORRECTED CHECK ***
                // Check if the result (usernamesResults[0]) is an array (the expected successful result)
                if (Array.isArray(usernamesResults?.[0])) {
                    const namesArray = usernamesResults[0]; // Directly use the result array
                    namesArray.forEach((name, j) => {
                        if (name && typeof name === 'string' && name.trim() !== '') { // Also check if name is non-empty string
                            usernamesMap[chunk[j]] = name;
                        } else {
                             // Log if name is empty or not a string, but don't treat as critical failure
                             console.warn(`   ⚠️ No valid username found for published ID ${chunk[j]} (result was empty or invalid)`);
                        }
                    });
                } else {
                    // If it's not an array, something unexpected happened. Log it as an error.
                    console.error(`❌ Unexpected result format from multicall (usernames) for chunk starting at ${chunk[0]}. Expected array, got:`);
                    console.error(JSON.stringify(usernamesResults, null, 2));
                    overallStatus = 'error'; // Mark job as error
                    overallError = `Unexpected result format during username fetch for chunk starting at ${chunk[0]}.`;
                    // Decide whether to break or continue; continuing might be okay if other chunks succeed.
                }
            } catch (multicallError) {
                 // Catch actual errors from the multicall promise rejection
                 console.error(`❌ Exception during multicall (usernames) for chunk starting at ${chunk[0]}:`, multicallError);
                 overallStatus = 'error'; // Mark job as error
                 overallError = overallError || `Exception during username fetch for chunk starting at ${chunk[0]}: ${multicallError.message || multicallError}`; // Keep first error
                 // Decide whether to break or continue; let's continue for now.
            }
            await sleep(100);
        } // End for loop for username chunks
    } // End if (publishedIds.length > 0)
    console.log(`👤 Found usernames for ${Object.keys(usernamesMap).length} IDs.`);


    // --- API Processing & DB Saving ---
    // (No need for the usernameFetchFailed flag check anymore)
    const portraitsToSave = [];
    const processedIds = new Set(); // Track IDs processed in this run for CID map cleanup

    console.log(`⏳ Processing ${Object.keys(usernamesMap).length} IDs with usernames...`);
    for (const idStr in usernamesMap) {
        // ... (API processing logic - unchanged) ...
         const id = parseInt(idStr, 10);
         const user = usernamesMap[id];
         processedIds.add(id);
         if (!user) continue; // Should be filtered by check above, but keep safeguard
         try {
             console.log(`   → Checking API for ${user} (ID: ${id})...`);
             const res = await axios.get(PORTRAIT_API + encodeURIComponent(user), { timeout: 15_000, validateStatus: (status) => status === 200 });
             const cid = res.data?.settings?.profile?.avatar?.cid;
             const title = res.data?.settings?.profile?.title || user;
             const cleanedTitle = title.replace(/^<p>/i, '').replace(/<\/p>$/i, '').trim();
             if (!currentStatus.cidMap) currentStatus.cidMap = {};
             if (cid && currentStatus.cidMap[id] !== cid) {
                 console.log(`      ↳ New CID found (${cid}). Adding/updating.`);
                 currentStatus.cidMap[id] = cid;
                 portraitsToSave.push({ id, username: cleanedTitle || user, imageUrl: IPFS_GATEWAY + cid, profileUrl: PUBLIC_PAGE + encodeURIComponent(user) });
             } else if (!cid) { console.log(`      ↳ No CID found for ${user}. Skipping DB save.`); }
             else { console.log(`      ↳ CID unchanged. Skipping DB save, but marking as checked.`); portraitsToSave.push({ id, updateTimestampOnly: true }); }
         } catch (apiError) {
             if (axios.isAxiosError(apiError) && apiError.response?.status === 404) { console.warn(`   ⚠️ API returned 404 for ${user} (ID: ${id}). Skipping.`); }
             else { console.error(`   ❌ Error fetching API for ${user} (ID: ${id}):`, apiError.message); }
         }
         await sleep(GAP_MS);
    }

    // --- CID Map Cleanup (unchanged) ---
    const finalUnpublishedSet = new Set(finalUnpublishedIds);
    if (currentStatus.cidMap) { for (const idStr in currentStatus.cidMap) { const id = parseInt(idStr, 10); if(finalUnpublishedSet.has(id)) { console.log(`   🧹 Removing CID entry for now-unpublished ID ${id}`); delete currentStatus.cidMap[id]; } } }

    // --- DB Save Transaction (unchanged, including error handling) ---
    if (portraitsToSave.length > 0) {
        console.log(`💾 Saving ${portraitsToSave.filter(p => !p.updateTimestampOnly).length} new/updated portraits and touching ${portraitsToSave.filter(p => p.updateTimestampOnly).length} others in DB...`);
        await new Promise((resolveTx, rejectTx) => {
            const insertStmt = db.prepare(`INSERT OR REPLACE INTO portraits (id, username, image_url, profile_url, last_checked_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`);
            const updateTimestampStmt = db.prepare(`UPDATE portraits SET last_checked_at = CURRENT_TIMESTAMP WHERE id = ?`);
            db.serialize(() => {
                db.run('BEGIN TRANSACTION;');
                let errorsInTx = 0; let savedCount = 0; let touchedCount = 0;
                portraitsToSave.forEach(p => { if (p.updateTimestampOnly) { updateTimestampStmt.run(p.id, function(err) { if (err) { errorsInTx++; console.error(`❌ DB Error updating timestamp for ID ${p.id}:`, err.message); } else touchedCount++; }); } else { insertStmt.run(p.id, p.username, p.imageUrl, p.profileUrl, function(err) { if (err) { errorsInTx++; console.error(`❌ DB Error saving portrait ID ${p.id}:`, err.message); } else savedCount++; }); } });
                insertStmt.finalize((err) => { if (err) console.error("Error finalizing insertStmt:", err.message); });
                updateTimestampStmt.finalize((err) => { if (err) console.error("Error finalizing updateTimestampStmt:", err.message); });
                if (errorsInTx > 0) { db.run('ROLLBACK;', (rollbackErr) => { if (rollbackErr) { rejectTx(new Error(`Transaction failed with ${errorsInTx} errors and rollback failed: ${rollbackErr.message}`)); } else { console.warn(`   ⚠️ Transaction rolled back due to ${errorsInTx} errors during save.`); overallStatus = 'error'; overallError = overallError || `${errorsInTx} errors occurred during DB save transaction. Rolled back.`; resolveTx(); } }); }
                else { db.run('COMMIT;', (commitErr) => { if (commitErr) { rejectTx(new Error(`Transaction commit failed: ${commitErr.message}`)); } else { console.log(`   ✅ Transaction committed. Saved: ${savedCount}, Touched: ${touchedCount}`); resolveTx(); } }); }
            });
        }).catch(txError => { // Catch potential promise rejection from transaction
            console.error("❌ Transaction Promise Rejected:", txError);
            overallStatus = 'error';
            overallError = overallError || `Transaction failed: ${txError.message}`;
        });
    } else {
        console.log("ℹ️ No new portrait data to save to DB in this run.");
    }

    // Determine final status - Success only if no errors were flagged during the process
    if (overallStatus !== 'error') {
        overallStatus = 'success';
    }

  } catch (error) {
    // Catch any unexpected errors from await calls
    console.error("❌❌❌ An critical unhandled error occurred during fetch job:", error);
    overallStatus = 'error';
    overallError = overallError || (error.message || String(error));
  } finally {
    console.log(`🏁 Finishing job. Overall Status: ${overallStatus}`);
    await updateJobStatus(
        overallStatus, overallError, maxIdOnChain,
        currentStatus.unpublishedIds, currentStatus.cidMap
    ).catch(err => console.error("❌ Final attempt to update job status failed:", err));
    closeDbAndExit(overallStatus === 'success' ? 0 : 1);
  }
} // --- End of runFetchJob Function ---