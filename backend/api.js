import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());

// --- Début des modifications ---

const cacheFilePath = path.resolve('./backend/cache.json');
const metaFilePath = path.resolve('./backend/meta.json'); // Chemin vers meta.json
let cachedPortraits = []; // Variable pour stocker les données en mémoire
let cacheStatus = { // Variable pour stocker le statut du chargement du cache
  loaded: false,
  timestamp: null,
  error: null,
  count: 0
};
let lastMetaReadStatus = { // Pour stocker le statut de la lecture de meta.json par l'API
  timestamp: null,
  error: null
}

// Fonction pour charger (ou recharger) les données depuis cache.json
function loadCache() {
  const now = new Date();
  console.log(`🔄 [${now.toISOString()}] Attempting to load cache from ${cacheFilePath}...`);
  try {
    const fileData = fs.readFileSync(cacheFilePath, 'utf-8');
    cachedPortraits = JSON.parse(fileData);
    cacheStatus = {
      loaded: true,
      timestamp: now.toISOString(),
      error: null,
      count: cachedPortraits.length
    };
    console.log(`✅ Cache loaded successfully. ${cacheStatus.count} portraits in memory.`);
  } catch (error) {
    cacheStatus = {
      loaded: false,
      timestamp: now.toISOString(),
      error: error.message, // Stocker le message d'erreur
      count: 0
    };
    if (error.code === 'ENOENT') {
      console.error(`❌ Error loading cache: File not found at ${cacheFilePath}. Starting with empty cache.`);
      cachedPortraits = [];
    } else if (error instanceof SyntaxError) {
      console.error(`❌ Error loading cache: Invalid JSON in ${cacheFilePath}. Starting with empty cache.`, error);
      cachedPortraits = [];
    } else {
      console.error(`❌ An unexpected error occurred while loading cache:`, error);
      cachedPortraits = [];
    }
  }
}

// Charger le cache au démarrage de l'application
loadCache();

// --- Fin des modifications ---


app.get('/api/portraits', (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 50);
  const data = cachedPortraits;
  const start = (page - 1) * limit;
  const total = data.length;
  const portraitsToSend = data.slice(start, start + limit);

  res.json({
    page,
    limit,
    total,
    portraits: portraitsToSend
  });
});

// --- Début du nouvel endpoint /api/status ---
app.get('/api/status', (req, res) => {
  let metaData = null;
  let cacheFileInfo = null;
  const now = new Date();
  lastMetaReadStatus.timestamp = now.toISOString(); // Mettre à jour le timestamp de lecture
  lastMetaReadStatus.error = null; // Réinitialiser l'erreur

  // Lire les informations du fichier cache.json (date de modif)
  try {
    const stats = fs.statSync(cacheFilePath);
    cacheFileInfo = {
      lastModified: stats.mtime.toISOString(),
      size: stats.size
    };
  } catch (error) {
    // Si le fichier cache n'existe pas, statSync échouera aussi
    if (error.code !== 'ENOENT') {
      console.error(`❌ Error getting cache file stats:`, error);
    }
    // L'info d'erreur est déjà dans cacheStatus
  }

  // Essayer de lire meta.json pour le statut de fetch-job
  try {
    metaData = JSON.parse(fs.readFileSync(metaFilePath, 'utf-8'));
  } catch (error) {
    lastMetaReadStatus.error = `Failed to read or parse meta.json: ${error.message}`;
    console.error(`❌ ${lastMetaReadStatus.error}`);
    // Ne pas écraser les données meta potentiellement utiles déjà présentes
    // metaData reste null ou garde sa dernière valeur lue (si on implémentait un cache pour meta)
  }

  res.json({
    server: {
      status: 'OK',
      currentTime: now.toISOString()
    },
    cache: {
      loaded: cacheStatus.loaded,
      lastLoadAttempt: cacheStatus.timestamp,
      loadError: cacheStatus.error,
      portraitCount: cacheStatus.count,
      fileLastModified: cacheFileInfo?.lastModified || null,
      fileSize: cacheFileInfo?.size || null
    },
    fetchJob: { // Données issues de meta.json (nécessite modif fetch-job.js)
      metaFileReadStatus: lastMetaReadStatus.error ? 'Error' : 'OK',
      metaFileLastError: lastMetaReadStatus.error,
      lastRunTimestamp: metaData?.lastRunTimestamp || null, // À ajouter dans meta.json par fetch-job.js
      lastRunStatus: metaData?.lastRunStatus || 'Unknown', // À ajouter ('success' / 'error')
      lastRunError: metaData?.lastRunError || null, // À ajouter si erreur
      highestIdSynced: metaData?.highestIdSaved || null,
      unpublishedIdsCount: metaData?.unpublishedIds?.length ?? null // Utiliser ?? pour gérer le cas où unpublishedIds n'existe pas
    }
  });
});
// --- Fin du nouvel endpoint /api/status ---

app.listen(3001, () =>
  console.log('🖥️  API → http://localhost:3001/api/portraits?page=1&limit=3\n📊  Status → http://localhost:3001/api/status')
);