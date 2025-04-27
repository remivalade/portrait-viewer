import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());

// --- Début des modifications ---

const cacheFilePath = path.resolve('./cache.json');
let cachedPortraits = []; // Variable pour stocker les données en mémoire

// Fonction pour charger (ou recharger) les données depuis cache.json
function loadCache() {
  console.log(`🔄 Attempting to load cache from ${cacheFilePath}...`);
  try {
    const fileData = fs.readFileSync(cacheFilePath, 'utf-8'); // Lire en utf-8
    cachedPortraits = JSON.parse(fileData); // Analyser le JSON
    console.log(`✅ Cache loaded successfully. ${cachedPortraits.length} portraits in memory.`);
  } catch (error) {
    // Gérer les erreurs potentielles
    if (error.code === 'ENOENT') {
      console.error(`❌ Error loading cache: File not found at ${cacheFilePath}. Starting with empty cache.`);
      cachedPortraits = []; // Utiliser un tableau vide si le fichier n'existe pas
    } else if (error instanceof SyntaxError) {
      console.error(`❌ Error loading cache: Invalid JSON in ${cacheFilePath}. Starting with empty cache.`, error);
      cachedPortraits = []; // Utiliser un tableau vide si le JSON est invalide
    } else {
      console.error(`❌ An unexpected error occurred while loading cache:`, error);
      cachedPortraits = []; // Sécurité : utiliser un tableau vide en cas d'autre erreur
    }
  }
}

// Charger le cache au démarrage de l'application
loadCache();

// Optionnel : Si vous voulez pouvoir recharger le cache sans redémarrer le serveur,
// vous pourriez ajouter un endpoint spécifique ou surveiller les changements du fichier.
// Exemple simple d'endpoint pour recharger (non sécurisé pour la production) :
// app.get('/api/reload-cache', (req, res) => {
//   loadCache();
//   res.send('Cache reload triggered.');
// });

// --- Fin des modifications ---


app.get('/api/portraits', (req, res) => {
  const page  = Number(req.query.page  || 1);
  const limit = Number(req.query.limit || 50);

  // --- Modification ---
  // Utiliser directement les données en mémoire (cachedPortraits)
  // au lieu de lire le fichier à chaque fois
  // const data = JSON.parse(
  //   fs.readFileSync(path.resolve('./backend/cache.json'))
  // );
  const data = cachedPortraits; // Utilisation du cache en mémoire
  // --- Fin Modification ---

  const start = (page - 1) * limit;
  // Calculer le nombre total d'éléments avant de découper pour la pagination
  const total = data.length;
  const portraitsToSend = data.slice(start, start + limit);

  res.json({
    page,
    limit, // Ajout de la limite dans la réponse pour info
    total,
    portraits: portraitsToSend // Envoyer uniquement la tranche paginée
  });
});

app.listen(3001, () =>
  console.log('🖥️  API → http://localhost:3001/api/portraits?page=1&limit=3')
);