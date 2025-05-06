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
// ---------- helpers -------------------------------------------------------
function toAvatarImage(row) {
  // 1️⃣ prefer image_url (IPFS)
  if (row.image_url) {
    // convert ipfs://CID to an HTTPS gateway URL
    if (row.image_url.startsWith('ipfs://')) {
      const cid = row.image_url.slice(7);
      return `https://w3s.link/ipfs/${cid}`;   // use any gateway you like
    }
    return row.image_url; // already http(s)
  }
  // 2️⃣ fallback: Arweave tx
  if (row.image_arweave_tx) {
    // store either the full URL or just the tx-id; handle both
    return row.image_arweave_tx.startsWith('http')
      ? row.image_arweave_tx
      : `https://arweave.net/${row.image_arweave_tx}`;
  }
  // 3️⃣ nothing available
  return null;
}
// ---------- filters -------------------------------------------------------

function buildFilter(sqlParts) {
  // sqlParts is an array we push "field = ?" strings into
  // and return { where, params } ready for sqlite
  const tokens = ( (sqlParts.filter || '').toString() )
                .split(',').map(t => t.trim()).filter(Boolean);

  const where = [];
  const params = [];

  if (!tokens.length || tokens.includes('live'))       // default
    where.push('is_published = 1');

  if (tokens.includes('avatar'))
    where.push('(image_url IS NOT NULL OR image_arweave_tx IS NOT NULL)');

  if (tokens.includes('all'))  where.length = 0;       // override

  return {
    whereClause: where.length ? 'WHERE ' + where.join(' AND ') : '',
    params      // none yet; kept for future use
  };
}

// --- API Endpoints ---

// Endpoint to get paginated portraits
app.get('/api/portraits', async (req, res) => {
  const page   = Number(req.query.page   || 1);
  const limit  = Number(req.query.limit  || 50);
  const filter = (req.query.filter || '').toString();   // ← live / avatar / all

  if (page < 1 || limit < 1 || limit > 100) {
    return res.status(400).json({ error: 'Invalid page or limit parameter.' });
  }
  const offset = (page - 1) * limit;

  /* -------- build WHERE clause from filter ----------------------------- */
  const tokens = filter.split(',').map(t => t.trim()).filter(Boolean);
  const where  = [];

  if (!tokens.length || tokens.includes('live'))        where.push('is_published = 1');
  if (tokens.includes('avatar'))                       where.push('(image_url IS NOT NULL OR image_arweave_tx IS NOT NULL)');
  if (tokens.includes('all'))                          where.length = 0;   // override

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    /* run total + page queries in parallel */
    const [totalRow, rows] = await Promise.all([
      dbGet(`SELECT COUNT(*) AS total FROM portraits ${whereSql}`),
      dbAll(`
        SELECT id, username, image_url, image_arweave_tx,
               profile_url, is_published
        FROM portraits
        ${whereSql}
        ORDER BY id ASC
        LIMIT ? OFFSET ?`,
        [limit, offset]
      )
    ]);

    const portraits = rows.map(r => ({
      id:            r.id,
      username:      r.username,
      avatar_image:  toAvatarImage(r),
      profile_url:   r.profile_url,
      is_live:       !!r.is_published,
    }));

    res.json({ page, limit, total: totalRow.total, portraits });

  } catch (err) {
    console.error(`❌ Error fetching portraits:`, err.message);
    res.status(500).json({ error: 'Failed to retrieve portraits.' });
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
  const q      = (req.query.q || '').toString().trim();
  const page   = Number(req.query.page   || 1);
  const limit  = Number(req.query.limit  || 50);
  const filter = (req.query.filter || '').toString();

  if (q.length < 3) return res.json({ page: 1, limit, total: 0, portraits: [] });
  if (page < 1 || limit < 1 || limit > 100)
    return res.status(400).json({ error: 'Invalid page or limit parameter.' });

  const offset = (page - 1) * limit;

  /* -------- build WHERE from filter (same rules as above) -------------- */
  const tokens = filter.split(',').map(t => t.trim()).filter(Boolean);
  const where  = [];

  if (!tokens.length || tokens.includes('live'))        where.push('p.is_published = 1');
  if (tokens.includes('avatar'))                       where.push('(p.image_url IS NOT NULL OR p.image_arweave_tx IS NOT NULL)');
  if (tokens.includes('all'))                          where.length = 0;

  const whereSql = where.length ? `AND ${where.join(' AND ')}` : '';

  try {
    const [totalRow, rows] = await Promise.all([
      dbGet(`
        SELECT COUNT(*) AS total
        FROM portraits p
        JOIN portraits_fts fts ON p.id = fts.rowid
        WHERE portraits_fts MATCH ? ${whereSql}`,
        [q + '*']
      ),
      dbAll(`
        SELECT p.id, p.username, p.image_url, p.image_arweave_tx,
               p.profile_url, p.is_published
        FROM portraits p
        JOIN portraits_fts fts ON p.id = fts.rowid
        WHERE portraits_fts MATCH ? ${whereSql}
        ORDER BY fts.rank
        LIMIT ? OFFSET ?`,
        [q + '*', limit, offset]
      )
    ]);

    const portraits = rows.map(r => ({
      id:            r.id,
      username:      r.username,
      avatar_image:  toAvatarImage(r),
      profile_url:   r.profile_url,
      is_live:       !!r.is_published,
    }));

    res.json({ page, limit, total: totalRow.total, portraits });

  } catch (err) {
    console.error(`❌ Error searching portraits:`, err.message);
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
