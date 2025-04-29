import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs'; // Keep fs only for checking DB file existence/stats if needed

const app = express();
app.use(cors());

const dbPath = path.resolve('./backend/portraits.sqlite');
const verboseSqlite3 = sqlite3.verbose(); // Use verbose for better logging

// --- SQLite Database Connection ---
// Use OPEN_READONLY for the API server as it shouldn't modify data
// Use OPEN_CREATE flag only if you absolutely need the API server to create the DB file
const db = new verboseSqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error(`❌ Error connecting to SQLite database at ${dbPath}:`, err.message);
    // Exit or handle gracefully if DB connection fails - essential for API functionality
    // For simplicity here, we log the error. In production, you might exit or return errors on all endpoints.
  } else {
    console.log(`✅ Connected to the SQLite database: ${dbPath}`);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('❌ Error closing database connection:', err.message);
    } else {
      console.log('ℹ️ Database connection closed.');
    }
    process.exit(0);
  });
});


// --- API Endpoints ---

app.get('/api/portraits', (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1)); // Ensure page is at least 1
  const limit = Math.max(1, Number(req.query.limit || 50)); // Ensure limit is at least 1
  const offset = (page - 1) * limit;

  const countSql = `SELECT COUNT(*) as total FROM portraits;`;
  const selectSql = `SELECT id, username, image_url, profile_url FROM portraits ORDER BY id ASC LIMIT ? OFFSET ?;`;

  // Use db.get for single row result (count) and db.all for multiple rows
  db.get(countSql, [], (err, countRow) => {
    if (err) {
      console.error('❌ Database error getting total count:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve portrait count' });
    }

    const total = countRow?.total || 0;

    db.all(selectSql, [limit, offset], (err, portraitRows) => {
      if (err) {
        console.error('❌ Database error getting portraits:', err.message);
        return res.status(500).json({ error: 'Failed to retrieve portraits' });
      }

      res.json({
        page,
        limit,
        total,
        portraits: portraitRows || [] // Ensure portraits is always an array
      });
    });
  });
});


app.get('/api/status', (req, res) => {
  const now = new Date();
  let dbStats = null;

  // Optional: Get database file stats
  try {
    const stats = fs.statSync(dbPath);
    dbStats = {
      lastModified: stats.mtime.toISOString(),
      size: stats.size
    };
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`⚠️ Could not get stats for DB file ${dbPath}:`, err.message);
    }
    // If ENOENT, the DB doesn't exist yet, which is handled by job status query
  }

  // Get job status and portrait count from DB
  const statusSql = `SELECT * FROM job_status WHERE job_name = 'fetch-job' LIMIT 1;`;
  const countSql = `SELECT COUNT(*) as count FROM portraits;`;

  db.get(statusSql, [], (err, statusRow) => {
    if (err && err.message.includes('no such table: job_status')) {
        console.warn('⚠️ job_status table not found. Fetch job likely hasn\'t run yet.');
        // Return default/empty status if table doesn't exist
        return db.get(countSql, [], (countErr, countRow) => {
             res.json({
                server: { status: 'OK', currentTime: now.toISOString() },
                database: {
                    fileStatus: dbStats ? 'Exists' : 'NotFound',
                    ...dbStats,
                    portraitCount: countErr ? null : (countRow?.count ?? 0),
                    connection: 'OK' // Assumes connection was OK if we reached here
                },
                fetchJob: { status: 'NotRunYet' } // Indicate job hasn't run
             });
        });
    } else if (err) {
      console.error('❌ Database error getting job status:', err.message);
      // Can't reliably get status, return an error state
       return db.get(countSql, [], (countErr, countRow) => {
           res.status(500).json({
                server: { status: 'OK', currentTime: now.toISOString() },
                database: {
                    fileStatus: dbStats ? 'Exists' : 'ErrorChecking',
                     ...dbStats,
                     portraitCount: countErr ? null : (countRow?.count ?? 0),
                     connection: 'OK'
                },
                fetchJob: { status: 'ErrorReadingStatus', error: err.message }
           });
       });
    }

    // Get count even if status query succeeded
    db.get(countSql, [], (countErr, countRow) => {
        if (countErr) {
             console.error('❌ Database error getting portrait count:', countErr.message);
             // Return status info but indicate count error
        }

        let unpublishedIdsCount = null;
        if (statusRow?.unpublished_ids_json) {
            try {
                const ids = JSON.parse(statusRow.unpublished_ids_json);
                unpublishedIdsCount = Array.isArray(ids) ? ids.length : null;
            } catch (parseErr) {
                console.error('❌ Error parsing unpublished_ids_json from DB:', parseErr);
            }
        }

        res.json({
            server: {
                status: 'OK',
                currentTime: now.toISOString()
            },
            database: {
                fileStatus: dbStats ? 'Exists' : 'NotFound', // Or ErrorChecking if stat failed
                ...dbStats,
                portraitCount: countErr ? null : (countRow?.count ?? 0),
                connection: 'OK' // DB connection must be ok to get here
            },
            fetchJob: { // Data from job_status table
                status: statusRow ? 'OK' : 'NotRunYet', // If statusRow is null/undefined
                lastRunTimestamp: statusRow?.last_run_timestamp || null,
                lastRunStatus: statusRow?.last_run_status || 'Unknown',
                lastRunError: statusRow?.last_run_error || null,
                highestIdSynced: statusRow?.highest_id_processed || null,
                unpublishedIdsCount: unpublishedIdsCount
                // cid_map is likely too large/not useful for status endpoint
            }
        });
    });
  });
});


app.listen(3001, () =>
  console.log('🚀 API Server running with SQLite backend.\n' +
              '✅ Portraits endpoint → http://localhost:3001/api/portraits?page=1&limit=3\n' +
              '📊 Status endpoint → http://localhost:3001/api/status')
);