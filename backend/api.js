// ----------------------------------------------------------
// API Server using Express and SQLite
// ----------------------------------------------------------

import express from 'express';
import cors from 'cors';
import path from 'path';
import sqlite3 from 'sqlite3';
import fs from 'fs/promises'; // Use promises for async file stats

// --- Configuration ---
// Resolve path relative to the script's execution directory
// Assumes script is run from project_root/backend
const dbPath = path.resolve('./portraits.sqlite');
const metaFilePath = path.resolve('./meta.json'); // Keep meta.json check for now? Or rely solely on DB status? Let's check both.
const JOB_NAME = 'fetch-job'; // Key used in job_status table
const PORT = process.env.PORT || 3001;

// --- Database Connection ---
const verboseSqlite3 = sqlite3.verbose();
// Open in Read Only mode for safety, as API should not modify data
// OPEN_CREATE flag is removed, assuming fetch-job creates the DB file.
const db = new verboseSqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    // Log error but don't exit, API might still provide partial status
    console.error(`❌ Error connecting to database ${dbPath} in read-only mode:`, err.message);
    console.error("   API will run but '/api/portraits' endpoint will likely fail.");
  } else {
    console.log(`✅ Connected to SQLite database in read-only mode: ${dbPath}`);
  }
});

// --- Database Query Functions (Read-Only) ---
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        console.error(`❌ DB Error executing (Read): ${sql}`, params, err.message);
        reject(err); // Reject on read errors
      } else {
        resolve(row); // Returns the row or undefined
      }
    });
  });
}

function dbAll(sql, params = []) {
   return new Promise((resolve, reject) => {
     db.all(sql, params, (err, rows) => {
       if (err) {
         console.error(`❌ DB Error executing (Read): ${sql}`, params, err.message);
         reject(err); // Reject on read errors
       } else {
         resolve(rows); // Returns array of rows
       }
     });
   });
}


// --- Express App Setup ---
const app = express();
app.use(cors()); // Enable CORS for all origins

// --- API Endpoints ---

// Endpoint to get paginated portraits
app.get('/api/portraits', async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 50);

  if (page < 1 || limit < 1 || limit > 100) { // Basic validation
    return res.status(400).json({ error: 'Invalid page or limit parameter.' });
  }

  const offset = (page - 1) * limit;

  try {
    // Use Promise.all to run count and data queries concurrently
    const [totalResult, portraitsResult] = await Promise.all([
      dbGet(`SELECT COUNT(*) as total FROM portraits`),
      dbAll(
        `SELECT id, username, image_url, profile_url, image_arweave_tx
         FROM portraits
         ORDER BY id ASC
         LIMIT ? OFFSET ?`,
        [limit, offset]
      )
    ]);

    const total = totalResult?.total || 0;

    res.json({
      page,
      limit,
      total,
      portraits: portraitsResult || [] // Ensure portraits is always an array
    });

  } catch (error) {
    // Log the error on the server
    console.error(`❌ Error fetching portraits (page: ${page}, limit: ${limit}):`, error.message);
    // Send generic error to client
    res.status(500).json({ error: 'Failed to retrieve portraits from database.' });
  }
});

// Endpoint to get application status
app.get('/api/status', async (req, res) => {
  let dbStats = { accessible: false, fileSize: null, fileLastModified: null, portraitCount: null };
  let jobStatus = { metaFileReadStatus: 'Not Found', lastRunTimestamp: null, lastRunStatus: 'Unknown', lastRunError: null, highestIdProcessed: null, unpublishedIdsCount: null };

  // 1. Check Database File Stats & Count
  try {
    const stats = await fs.stat(dbPath);
    dbStats.accessible = true;
    dbStats.fileSize = stats.size;
    dbStats.fileLastModified = stats.mtime.toISOString();
    // Try getting count from DB if accessible
    try {
        const countResult = await dbGet(`SELECT COUNT(*) as count FROM portraits`);
        dbStats.portraitCount = countResult?.count ?? null; // Use nullish coalescing
    } catch(countError) {
        console.warn("⚠️ Could not get portrait count from DB:", countError.message);
        // Keep portraitCount as null
    }
  } catch (error) {
    if (error.code !== 'ENOENT') { // Log errors other than file not found
      console.warn(`⚠️ Could not get stats for DB file ${dbPath}:`, error.message);
    }
    // dbStats remains inaccessible
  }

  // 2. Get Job Status from Database
  try {
      const jobRow = await dbGet(`SELECT * FROM job_status WHERE job_name = ?`, [JOB_NAME]);
      if (jobRow) {
          jobStatus.metaFileReadStatus = 'OK (from DB)'; // Indicate source
          jobStatus.lastRunTimestamp = jobRow.last_run_timestamp;
          jobStatus.lastRunStatus = jobRow.last_run_status;
          jobStatus.lastRunError = jobRow.last_run_error;
          jobStatus.highestIdProcessed = jobRow.highest_id_processed;
          try {
              const unpublishedIds = JSON.parse(jobRow.unpublished_ids_json || '[]');
              jobStatus.unpublishedIdsCount = Array.isArray(unpublishedIds) ? unpublishedIds.length : null;
          } catch (e) {
              console.warn("⚠️ Failed to parse unpublished_ids_json from DB status:", e.message);
              jobStatus.unpublishedIdsCount = null;
          }
      } else {
           jobStatus.metaFileReadStatus = 'Not Found (in DB)';
      }
  } catch (dbError) {
      console.error("❌ Error reading job_status from DB:", dbError.message);
      jobStatus.metaFileReadStatus = 'Error reading DB';
      jobStatus.metaFileLastError = dbError.message;
  }

  // Construct final status object
  const responseStatus = {
      server: {
          status: "OK",
          currentTime: new Date().toISOString()
      },
      database: dbStats,
      fetchJob: jobStatus
  };

  res.json(responseStatus);
});

  // 3. Search Portraits

app.get('/api/portraits/search', async (req, res) => {
  const query = req.query.q || ''; // Terme de recherche
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 50); // Gardons la même limite par défaut

  // Validation simple
  if (typeof query !== 'string' || query.trim().length < 3) {
    // Retourne un résultat vide si la recherche est trop courte ou invalide
    // Ou vous pourriez retourner une erreur 400
    return res.json({ page: 1, limit, total: 0, portraits: [] });
  }
  if (page < 1 || limit < 1 || limit > 100) {
    return res.status(400).json({ error: 'Invalid page or limit parameter.' });
  }

  const offset = (page - 1) * limit;
  const searchTerm = query.trim(); // Utiliser le terme nettoyé

  try {
    // Utiliser Promise.all pour exécuter les requêtes de comptage et de données en parallèle
    const [totalResult, portraitsResult] = await Promise.all([
      // Compte le nombre total de résultats correspondants
      dbGet(
        `SELECT COUNT(*) as total
         FROM portraits p JOIN portraits_fts fts ON p.id = fts.rowid
         WHERE portraits_fts MATCH ?`,
        [searchTerm] // Le terme pour MATCH
      ),
      // Récupère les données paginées correspondantes
      dbAll(
        `SELECT p.id, p.username, p.image_url, p.profile_url, p.image_arweave_tx
         FROM portraits p JOIN portraits_fts fts ON p.id = fts.rowid
         WHERE portraits_fts MATCH ?
         ORDER BY p.id ASC -- Ou un autre tri si pertinent (ex: rank FTS)
         LIMIT ? OFFSET ?`,
        [searchTerm, limit, offset] // Paramètres pour MATCH, LIMIT, OFFSET
      )
    ]);

    const total = totalResult?.total || 0;

    res.json({
      page,
      limit,
      total,
      portraits: portraitsResult || [] // Assure que c'est toujours un tableau
    });

  } catch (error) {
    console.error(`❌ Error searching portraits (query: ${searchTerm}, page: ${page}, limit: ${limit}):`, error.message);
    res.status(500).json({ error: 'Failed to search portraits.' });
  }
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`🖥️ API Server started successfully.`);
  console.log(`   Listening on: http://localhost:${PORT}`);
  console.log(`   Portraits endpoint: http://localhost:${PORT}/api/portraits?page=1&limit=10`);
  console.log(`   Status endpoint:    http://localhost:${PORT}/api/status`);
});

// --- Graceful Shutdown ---
process.on('SIGINT', () => {
  console.log('🔌 SIGINT received. Shutting down API server...');
  db.close((err) => {
    if (err) {
      console.error('❌ Error closing database connection during shutdown:', err.message);
      process.exit(1);
    } else {
      console.log('✅ Database connection closed. Exiting.');
      process.exit(0);
    }
  });
});
