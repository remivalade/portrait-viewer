
// ----------------------------------------------------------
// Incremental Portrait sync with viem multicall & SQLite
// Includes Arweave TX ID handling
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
const IPFS_GATEWAY  = 'https://ipfs.io/ipfs/'; // Or your preferred gateway

const BATCH    = 500;   // size of on-chain multicall chunks
const GAP_MS   = 1000;  // throttle API requests (~60/min)

// Resolve path relative to the script's execution directory
// Assumes script is run from project_root/backend
const dbPath = path.resolve('./portraits.sqlite');
console.log('DEBUG: Resolving dbPath to:', dbPath); // Add this for debugging
const JOB_NAME = 'fetch-job'; // Used as key in job_status table

const sleep = ms => new Promise(r => setTimeout(r, ms));

// --- Database Setup ---
const verboseSqlite3 = sqlite3.verbose();
const db = new verboseSqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, async (err) => { // Ensure flags allow creation
  if (err) {
    console.error(`❌ Fatal: Could not connect/create database ${dbPath}:`, err.message);
    process.exit(1);
  } else {
    console.log(`✅ Connected to SQLite database: ${dbPath}`);
    try {
      await initializeDb();
      await runFetchJob(); // Run the main logic only after DB is ready
    } catch (initErr) {
        console.error(`❌ Fatal: Database initialization or fetch job failed:`, initErr);
        closeDbAndExit(1);
    }
  }
});

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) { // Use function() to access this.lastID, this.changes
      if (err) {
        console.error(`❌ DB Error executing: ${sql}`, params, err.message);
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        console.error(`❌ DB Error executing: ${sql}`, params, err.message);
        reject(err);
      } else {
        resolve(row); // Returns the row or undefined if not found
      }
    });
  });
}

function dbAll(sql, params = []) {
   return new Promise((resolve, reject) => {
     db.all(sql, params, (err, rows) => {
       if (err) {
         console.error(`❌ DB Error executing: ${sql}`, params, err.message);
         reject(err);
       } else {
         resolve(rows); // Returns array of rows (empty if none found)
       }
     });
   });
}


async function initializeDb() {
  console.log("🚀 Initializing database schema...");
  await dbRun(`
    CREATE TABLE IF NOT EXISTS portraits (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      image_url TEXT,             -- Stores the IPFS URL (nullable)
      profile_url TEXT NOT NULL,
      image_arweave_tx TEXT,      -- Stores the Arweave TX ID (nullable)
      last_checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("✅ 'portraits' table ensured.");

  // Add index on username for faster lookups if needed (optional)
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_portraits_username ON portraits (username);`);
  console.log("✅ Index on 'portraits.username' ensured.");

  await dbRun(`
    CREATE TABLE IF NOT EXISTS job_status (
      job_name TEXT PRIMARY KEY,
      last_run_timestamp DATETIME,
      last_run_status TEXT,
      last_run_error TEXT,
      highest_id_processed INTEGER DEFAULT 0,
      unpublished_ids_json TEXT DEFAULT '[]'
      -- Removed cid_map_json
    )
  `);
  console.log("✅ 'job_status' table ensured.");

    // *** Création de la table FTS5 ***
    await dbRun(`
      CREATE VIRTUAL TABLE IF NOT EXISTS portraits_fts USING fts5(
          username,                        -- Colonne à indexer pour la recherche
          content='portraits',             -- Table source du contenu
          content_rowid='id',              -- Colonne ID de la table source
          tokenize='unicode61 remove_diacritics 2' -- Pour recherche insensible casse/accents
      );
    `);
    console.log("✅ 'portraits_fts' virtual table ensured for searching.");
  console.log("✅ Database schema initialization complete.");
}

async function updateJobStatus(status, error = null, highestId = null, unpublishedIds = null) {
  console.log(`💾 Attempting to update job status: ${status}`);
  const sql = `
    INSERT OR REPLACE INTO job_status
    (job_name, last_run_timestamp, last_run_status, last_run_error, highest_id_processed, unpublished_ids_json)
    VALUES (?, ?, ?, ?,
      COALESCE(?, (SELECT highest_id_processed FROM job_status WHERE job_name = ?)),
      COALESCE(?, (SELECT unpublished_ids_json FROM job_status WHERE job_name = ?))
      -- Removed cid_map_json
    )
  `;
  const params = [
    JOB_NAME, new Date().toISOString(), status,
    error ? String(error).substring(0, 1000) : null, // Truncate long errors
    highestId, JOB_NAME, // For COALESCE highest_id_processed
    unpublishedIds !== null ? JSON.stringify(unpublishedIds) : null, JOB_NAME // For COALESCE unpublished_ids_json
  ];

  try {
    await dbRun(sql, params);
    console.log(`💾 Job status updated successfully: ${status}.`);
  } catch (err) {
    // Error already logged by dbRun, but log context here
    console.error("❌ Failed to update job status in database.");
    console.error("   Status being set:", status);
    console.error("   Params (error truncated):", JSON.stringify(params.slice(0, 4)));
    // Re-throw or handle as needed, maybe log to separate file?
    // For now, we log and continue to ensure DB closure attempt
  }
}


async function getClient() {
  // Added longer timeout for potentially slow RPCs
  console.log("🛰️  Attempting to find working RPC...");
  for (const url of RPC_URLS) {
    const client = createPublicClient({
        chain: BaseSepoliaChain,
        transport: http(url, { timeout: 20000 }) // Increased timeout
    });
    try {
      // Perform a simple call that requires fetching data
      await client.getBlockNumber({ maxAge: 0 }); // maxAge: 0 forces fresh data
      console.log('🛰️  RPC OK →', url);
      return client;
    } catch (err) {
      console.warn(`RPC down → ${url} (${err.message || 'Timeout'})`);
    }
  }
  throw new Error('No RPC reachable');
}

function closeDbAndExit(exitCode = 0) {
    console.log(`ℹ️ Attempting to close database and exit with code ${exitCode}...`);
    db.close((err) => {
      if (err) {
        console.error('❌ Error closing database connection:', err.message);
        process.exit(err ? 1 : exitCode); // Ensure non-zero exit code if close fails
      } else {
        console.log('✅ Database connection closed.');
        process.exit(exitCode);
      }
    });
    // Force exit after a delay if closing hangs (safety net)
    setTimeout(() => {
        console.error("❌ Database close timed out. Forcing exit.");
        process.exit(exitCode !== 0 ? exitCode : 1); // Ensure non-zero exit on timeout
    }, 5000);
}

// --- Main Fetch Logic Wrapped in a Function ---
async function runFetchJob() {
  let currentStatus = { highestIdSaved: 0, unpublishedIds: [] }; // Removed cidMap
  let maxIdOnChain = 0;
  let overallStatus = 'running'; // Default to running
  let overallError = null;

  try {
    await updateJobStatus('running'); // Mark job as running

    // Load previous state from DB
    const row = await dbGet(`SELECT highest_id_processed, unpublished_ids_json FROM job_status WHERE job_name = ?`, [JOB_NAME]);
    if (row) {
        currentStatus.highestIdSaved = row.highest_id_processed || 0;
        try {
            currentStatus.unpublishedIds = JSON.parse(row.unpublished_ids_json || '[]');
            if (!Array.isArray(currentStatus.unpublishedIds)) {
                console.warn("⚠️ unpublished_ids_json from DB was not an array, resetting.");
                currentStatus.unpublishedIds = [];
            }
        } catch (e) {
            console.warn("⚠️ Couldn't parse unpublished_ids_json, resetting.", e.message);
            currentStatus.unpublishedIds = [];
        }
        console.log(`ℹ️ Loaded state: highestId=${currentStatus.highestIdSaved}, unpublished=${currentStatus.unpublishedIds.length}`);
    } else {
        console.log("ℹ️ No previous state found in DB, starting fresh.");
        currentStatus = { highestIdSaved: 0, unpublishedIds: [] };
        // Optionally insert initial state if needed? Assumes UPDATE OR REPLACE handles it.
    }

    const client = await getClient();

    // 1. Get Max ID
    maxIdOnChain = Number(
      await client.readContract({
        address: CONTRACTS.id,
        abi: [ { "inputs": [], "name": "portraitIdCounter", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" } ],
        functionName: 'portraitIdCounter'
       })
    );
    console.log(`ℹ️ Current max ID on chain: ${maxIdOnChain}`);

    // 2. Determine Candidate IDs
    const newIds = [];
    const startId = Number(currentStatus.highestIdSaved) || 0;
    for (let i = startId + 1; i <= maxIdOnChain; i++) { newIds.push(i); }
    // Ensure unpublishedIds is an array before concatenating
    const unpublished = Array.isArray(currentStatus.unpublishedIds) ? currentStatus.unpublishedIds : [];
    // Use Set for efficient merging and deduplication
    const candidateIds = Array.from(new Set([...newIds, ...unpublished]));

    if (candidateIds.length === 0 && maxIdOnChain === startId) {
      console.log('✅  Nothing new to sync.');
      overallStatus = 'success';
      // Update status even if nothing to sync, to record successful check
      await updateJobStatus(overallStatus, null, maxIdOnChain, currentStatus.unpublishedIds);
      closeDbAndExit(0);
      return; // Exit cleanly
    }
    console.log(`🔍  Checking ${candidateIds.length} candidate IDs (Range: ${startId + 1} to ${maxIdOnChain}, plus ${unpublished.length} previous unpublished)`);

    // 3. Check Publish Status (portraitIdToPortraitHash)
    const publishedIds = [];
    const stillUnpublishedIds = new Set(); // Use Set for efficient checks
    console.log(`🔎 Checking published state for ${candidateIds.length} IDs...`);
    for (let i = 0; i < candidateIds.length; i += BATCH) {
      const chunk = candidateIds.slice(i, i + BATCH);
      console.log(`    Pinging state for IDs ${chunk[0]} to ${chunk[chunk.length - 1]}... (${Math.round(((i+chunk.length)/candidateIds.length)*100)}%)`);
      const hashesResults = await client.multicall({
          contracts: chunk.map(id => ({
            address: CONTRACTS.state,
            abi: [ { "inputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "name": "portraitIdToPortraitHash", "outputs": [ { "internalType": "string", "name": "", "type": "string" } ], "stateMutability": "view", "type": "function" } ],
            functionName: 'portraitIdToPortraitHash',
            args: [BigInt(id)]
          })),
          allowFailure: true // Allow individual calls to fail without stopping the batch
      });

      hashesResults.forEach((resultObj, idx) => {
          const currentId = chunk[idx];
          if (resultObj?.status === 'success') {
              // A non-empty string result means it's published
              if (resultObj.result && typeof resultObj.result === 'string' && resultObj.result.trim() !== '' && resultObj.result !== '0x') {
                  publishedIds.push(currentId);
              } else {
                  stillUnpublishedIds.add(currentId); // Mark as unpublished
              }
          } else {
              console.error(`   ⚠️ Error checking state for ID ${currentId}: ${resultObj?.error?.shortMessage || 'Unknown multicall error'}`);
              stillUnpublishedIds.add(currentId); // Treat as unpublished on error
          }
      });
      if (candidateIds.length > BATCH) await sleep(100); // Small delay between batches
    }
    // Update the list for the next run - only keep IDs that were *still* unpublished in this run
    currentStatus.unpublishedIds = Array.from(stillUnpublishedIds);
    console.log(`🔎 State check done: ${publishedIds.length} published / ${currentStatus.unpublishedIds.length} considered unpublished.`);


    // 4. Fetch Usernames for Published IDs
    let usernamesMap = {}; // { id: username }
    if (publishedIds.length > 0) {
        console.log(`👤 Fetching usernames for ${publishedIds.length} published IDs...`);
        for (let i = 0; i < publishedIds.length; i += BATCH) {
            const chunk = publishedIds.slice(i, i + BATCH);
             console.log(`    Pinging names for IDs ${chunk[0]} to ${chunk[chunk.length - 1]}... (${Math.round(((i+chunk.length)/publishedIds.length)*100)}%)`);
            try {
                const usernamesResults = await client.multicall({
                    contracts: [{
                      address: CONTRACTS.name,
                      abi: [ { "inputs": [ { "internalType": "uint256[]", "name": "portraitIds", "type": "uint256[]" } ], "name": "getNamesForPortraitIds", "outputs": [ { "internalType": "string[]", "name": "names", "type": "string[]" } ], "stateMutability": "view", "type": "function" } ],
                      functionName: 'getNamesForPortraitIds',
                      args: [chunk.map(id => BigInt(id))] // Convert IDs to BigInt for viem
                    }],
                    allowFailure: false // Fail fast if the whole batch fails
                });

                 // Check if the result (usernamesResults[0]) is an array
                if (Array.isArray(usernamesResults?.[0])) {
                    const namesArray = usernamesResults[0];
                    namesArray.forEach((name, j) => {
                        if (name && typeof name === 'string' && name.trim() !== '') {
                            usernamesMap[chunk[j]] = name;
                        } else {
                             console.warn(`   ⚠️ No valid username found for published ID ${chunk[j]}`);
                        }
                    });
                } else {
                    // Log unexpected format but try to continue
                    console.error(`❌ Unexpected result format from multicall (usernames) for chunk ${i}. Expected array.`);
                    console.error(JSON.stringify(usernamesResults, null, 2));
                    overallStatus = 'error'; // Mark job as having an error
                    overallError = overallError || `Unexpected result format during username fetch.`;
                }
            } catch (multicallError) {
                 // Catch actual errors from the multicall promise rejection
                 console.error(`❌ Exception during multicall (usernames) for chunk ${i}:`, multicallError.shortMessage || multicallError);
                 overallStatus = 'error';
                 overallError = overallError || `Exception during username fetch: ${multicallError.shortMessage || multicallError}`;
                 // Continue to next chunk despite error
            }
             if (publishedIds.length > BATCH) await sleep(100); // Small delay between batches
        } // End for loop for username chunks
    } // End if (publishedIds.length > 0)
    console.log(`👤 Found usernames for ${Object.keys(usernamesMap).length} IDs.`);

    // 5. Process API & Prepare DB Data
    const portraitsToSave = [];
    console.log(`⏳ Processing API for ${Object.keys(usernamesMap).length} IDs with usernames...`);
    let apiCounter = 0;
    for (const idStr in usernamesMap) {
         apiCounter++;
         const id = parseInt(idStr, 10);
         const user = usernamesMap[id];
         if (!user) continue; // Basic check

         let cid = null;           // Default to null
         let arweaveTx = null;     // Default to null
         let cleanedTitle = user;  // Default to username

         try {
             console.log(`   (${apiCounter}/${Object.keys(usernamesMap).length}) → Checking API for ${user} (ID: ${id})...`);
             const res = await axios.get(PORTRAIT_API.replace('http://', 'https://') + encodeURIComponent(user), {
                 timeout: 20000,
                 validateStatus: (status) => status === 200
             });

             // Attempt to extract image identifiers and title
             const avatarData = res.data?.settings?.profile?.avatar;
             cid = avatarData?.cid;
             arweaveTx = avatarData?.arweaveTxId; // Use correct field name
             const title = res.data?.settings?.profile?.title || user;
             cleanedTitle = title.replace(/<[^>]*>?/gm, '').trim() || user; // Ensure fallback

             // Log what was found (for information only)
             if (cid || arweaveTx) {
                 console.log(`      ↳ Image data found (CID: ${cid || 'none'}, Arweave: ${arweaveTx || 'none'}). Preparing for DB.`);
             } else {
                 console.log(`      ↳ No CID or Arweave TX found for ${user}. Preparing profile data only.`);
             }

         } catch (apiError) {
             // Log API errors but proceed to save profile info anyway
             console.warn(`   ⚠️ Error fetching API for ${user} (ID: ${id}): ${apiError.message}. Saving profile info without image data.`);
             // cid and arweaveTx remain null
         }

         // *** Always add the portrait to be saved/updated ***
         // Null values for image fields are handled by the database insert
         portraitsToSave.push({
             id: id,
             username: cleanedTitle,
             imageUrl: cid ? IPFS_GATEWAY + cid : null,
             profileUrl: PUBLIC_PAGE + encodeURIComponent(user),
             imageArweaveTx: arweaveTx ? `https://irys.portrait.host/${arweaveTx}` : null // Will be null if not found or API failed
         });

         await sleep(GAP_MS); // Throttle API requests
    } // End API processing loop

    // 6. Save Portraits to Database
    if (portraitsToSave.length > 0) {
        console.log(`💾 Saving ${portraitsToSave.length} new/updated portraits to DB...`);
        // Prepare statement outside the promise/serialize block
        const insertStmt = db.prepare(`
            INSERT OR REPLACE INTO portraits
            (id, username, image_url, profile_url, image_arweave_tx, last_checked_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);

        try {
            await new Promise((resolveTx, rejectTx) => {
                // Use serialize to ensure sequential execution within the transaction
                db.serialize(() => {
                    db.run('BEGIN TRANSACTION;', (beginErr) => {
                        if (beginErr) {
                            console.error("❌ BEGIN TRANSACTION failed:", beginErr.message);
                            return rejectTx(beginErr); // Reject promise if BEGIN fails
                        }

                        let insertErrors = []; // Collect actual errors, not just count
                        let savedCount = 0;

                        portraitsToSave.forEach(p => {
                            // Run insert/replace for each portrait
                            insertStmt.run(
                                p.id, p.username, p.imageUrl, p.profileUrl, p.imageArweaveTx,
                                function(runErr) { // Use function to potentially check this.changes
                                    if (runErr) {
                                        // Log immediately and collect error details
                                        const errorMsg = `ID ${p.id} (${p.username}): ${runErr.message}`;
                                        console.error(`   ❌ DB Insert Error - ${errorMsg}`);
                                        insertErrors.push(errorMsg);
                                    } else {
                                        savedCount++;
                                    }
                                }
                            );
                        }); // End forEach loop

                        // Decide whether to commit or rollback AFTER the loop finishes
                        if (insertErrors.length > 0) {
                            console.warn(`   ⚠️ Rolling back transaction due to ${insertErrors.length} errors during save.`);
                            console.warn(`   First few errors: ${insertErrors.slice(0, 5).join(', ')}`); // Log first few errors
                            db.run('ROLLBACK;', (rollbackErr) => {
                                overallStatus = 'error'; // Mark job status
                                overallError = overallError || `${insertErrors.length} errors during DB save. Rolled back.`;
                                if (rollbackErr) {
                                    console.error("❌ Rollback failed!", rollbackErr.message);
                                    // Still try to reject the outer promise
                                    rejectTx(new Error(`Transaction failed with ${insertErrors.length} errors and rollback also failed: ${rollbackErr.message}`));
                                } else {
                                    console.log("   ✅ Rollback successful.");
                                    resolveTx(); // Resolve promise even on rollback to allow finally block
                                }
                            });
                        } else {
                            // No errors during inserts, attempt commit
                            db.run('COMMIT;', (commitErr) => {
                                if (commitErr) {
                                    console.error("❌ Commit failed!", commitErr.message);
                                    // Reject the promise if commit fails
                                    rejectTx(new Error(`Transaction commit failed: ${commitErr.message}`));
                                } else {
                                    console.log(`   ✅ Transaction committed. Saved/Updated: ${savedCount}`);
                                    resolveTx(); // Resolve promise on successful commit
                                }
                            });
                        }
                    }); // End BEGIN TRANSACTION callback
                }); // End serialize
            }); // End Promise

            // Finalize the statement *after* the transaction promise resolves or rejects
            insertStmt.finalize((finalizeErr) => {
                if (finalizeErr) console.error("Error finalizing prepared statement after transaction:", finalizeErr.message);
            });

        } catch (txError) { // Catch promise rejection from BEGIN, COMMIT, ROLLBACK or explicit rejectTx calls
            console.error("❌ Transaction execution promise failed:", txError.message || txError);
            overallStatus = 'error'; // Ensure status reflects failure
            overallError = overallError || `Transaction failed: ${txError.message || txError}`;
            // Attempt to finalize statement even if transaction failed early
            // Check if insertStmt was prepared before finalizing
            if (insertStmt) {
                 insertStmt.finalize((finalizeErr) => {
                     if (finalizeErr) console.error("Error finalizing prepared statement after transaction error:", finalizeErr.message);
                 });
            }
        }
    } else {
        console.log("ℹ️ No new portrait data to save to DB in this run.");
    }
    // Determine final status - Success only if no critical errors were flagged
    if (overallStatus !== 'error') {
        overallStatus = 'success';
    }

  } catch (error) {
    // Catch any unexpected errors from major await calls (e.g., getClient, readContract)
    console.error("❌❌❌ An critical unhandled error occurred during fetch job:", error);
    overallStatus = 'error';
    overallError = overallError || (error.message || String(error));
  } finally {
    // Ensure status is updated regardless of success or failure
    console.log(`🏁 Finishing job. Overall Status: ${overallStatus}`);
    // Update status with the final outcome and latest state
    await updateJobStatus(
        overallStatus,
        overallError,
        maxIdOnChain, // Record the latest chain state we saw
        currentStatus.unpublishedIds // Record the latest list of unpublished IDs
        // Removed cidMap
    ).catch(err => console.error("❌ Final attempt to update job status failed:", err)); // Log but don't crash

    // Close DB and exit
    closeDbAndExit(overallStatus === 'success' ? 0 : 1);
  }
} // --- End of runFetchJob Function ---
