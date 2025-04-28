// ----------------------------------------------------------
// Incremental Portrait sync with viem multicall
// ----------------------------------------------------------

import fs from 'fs';
import axios from 'axios';
import { createPublicClient, http } from 'viem';

// Configuration pour la Base Sepolia
const RPC_URLS = [
  'https://sepolia.base.org',
  'https://1rpc.io/base-sepolia',
  'https://base-sepolia.blockpi.network/v1/rpc/public'
];

// Paramètres de la chaîne Base Sepolia (chainId 84531)
const BaseSepoliaChain = {
  id: 84531,
  name: 'Base Sepolia',
  network: 'base-sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: RPC_URLS } },
  contracts: {
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 11907934,
    },
  }
};

const CONTRACTS = {
  id:    '0x3cDc03BEb79ba3b9FD3b687C67BFDE70AFf46eBF', // PortraitIdRegistryV2
  name:  '0xc788716466009AD7219c78d8e547819f6092ec8F', // PortraitNameRegistry
  state: '0x320C9E64c9a68492A1EB830e64EE881D75ac5efd'  // PortraitStateRegistry
};

const PORTRAIT_API  = 'https://api.portrait.so/api/v2/user/latestportrait?name=';
const PUBLIC_PAGE   = 'https://portrait.so/';
const IPFS_GATEWAY  = 'https://ipfs.io/ipfs/';

const BATCH    = 500;   // taille des chunks on-chain
const GAP_MS   = 1200;  // tempo entre requêtes REST (~50/min)

const cacheFilePath = './backend/cache.json'; // Chemin vers cache.json
const metaFilePath = './backend/meta.json';   // Chemin vers meta.json

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Charger cache + meta (avec gestion d'erreur basique)
let portraits = [];
try { portraits = JSON.parse(fs.readFileSync(cacheFilePath, 'utf-8')); } catch (e) { console.warn(`Warn: Could not load ${cacheFilePath}`, e.message)}
let meta = { highestIdSaved: 0, unpublishedIds: [], cidMap: {} };
try { meta = JSON.parse(fs.readFileSync(metaFilePath, 'utf-8')); } catch (e) { console.warn(`Warn: Could not load ${metaFilePath}, starting fresh.`, e.message)}

// Essayer chaque RPC et créer un client viem
async function getClient() {
  for (const url of RPC_URLS) {
    const client = createPublicClient({
      chain: BaseSepoliaChain,
      transport: http(url, {timeout: 10000}) // Ajout d'un timeout pour le transport http
    });
    try {
      await client.getBlockNumber({maxAge: 0}); // maxAge: 0 pour forcer la requête
      console.log('🛰️  RPC OK →', url);
      return client;
    } catch(err) {
      console.warn(`RPC down → ${url} (${err.message})`); // Log l'erreur RPC
    }
  }
  throw new Error('No RPC reachable');
}

// --- Début du bloc Try/Catch/Finally ---
(async () => {
  try { // <-- Ajout du TRY
    const client = await getClient();

    // 1. IDs candidats (nouveaux + toujours non publiés)
    const maxId = Number(
      await client.readContract({
        address: CONTRACTS.id,
        abi: [ { "inputs": [], "name": "portraitIdCounter", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" } ],
        functionName: 'portraitIdCounter'
      })
    );
    const newIds = [];
    for (let i = meta.highestIdSaved + 1; i <= maxId; i++) newIds.push(i);
    const candidateIds = newIds.concat(meta.unpublishedIds || []); // Assurer que unpublishedIds est un tableau
    if (candidateIds.length === 0) {
      console.log('✅  Nothing new to sync');
      // -- Ajout Status Succès ici aussi si rien à faire --
      meta.lastRunTimestamp = new Date().toISOString();
      meta.lastRunStatus = 'success';
      meta.lastRunError = null;
      // -- Fin Ajout --
      return; // Quitter si rien à faire
    }
    console.log(`🔍  Checking ${candidateIds.length} candidate IDs`);

    // 2. Filtrer ceux qui ont un owner
    const idsWithOwner = [];
    for (let i = 0; i < candidateIds.length; i += BATCH) {
      const chunk = candidateIds.slice(i, i + BATCH);
      const ownersResults = await client.multicall({
        contracts: [{
          address: CONTRACTS.id,
          abi: [ { "inputs": [ { "internalType": "uint256[]", "name": "portraitIds", "type": "uint256[]" } ], "name": "getOwnersForPortraitIds", "outputs": [ { "internalType": "address[]", "name": "owners", "type": "address[]" } ], "stateMutability": "view", "type": "function" } ],
          functionName: 'getOwnersForPortraitIds',
          args: [chunk]
        }]
      });
      if (ownersResults[0]?.status === 'success') {
          const ownersArray = ownersResults[0].result;
          ownersArray.forEach((owner, j) => {
            if (owner !== '0x0000000000000000000000000000000000000000') {
              idsWithOwner.push(chunk[j]);
            }
          });
      } else {
        console.error(`Erreur multicall (owners) pour chunk ${i}:`, ownersResults[0]?.error);
        // Optionnel: décider si on continue avec les IDs restants ou si on arrête tout
      }
    }

    // 3. Check “published?” via PortraitStateRegistry
    const publishedIds = [];
    let stillUnpub = []; // Utiliser let pour pouvoir réassigner
    const tempUnpublished = []; // Pour stocker temporairement les IDs non publiés de cette passe
    for (let i = 0; i < idsWithOwner.length; i += BATCH) {
      const chunk = idsWithOwner.slice(i, i + BATCH);
      const hashesResults = await client.multicall({
        contracts: chunk.map(id => ({
          address: CONTRACTS.state,
          abi: [ { "inputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "name": "portraitIdToPortraitHash", "outputs": [ { "internalType": "string", "name": "", "type": "string" } ], "stateMutability": "view", "type": "function" } ],
          functionName: 'portraitIdToPortraitHash',
          args: [id]
        }))
      });
      hashesResults.forEach((resultObj, idx) => {
        if (resultObj?.status === 'success') {
          if (resultObj.result) {
            publishedIds.push(chunk[idx]);
          } else {
            tempUnpublished.push(chunk[idx]);
          }
        } else {
          console.error(`Erreur multicall (hashes) pour ID ${chunk[idx]}:`, resultObj?.error);
          tempUnpublished.push(chunk[idx]); // Considérer comme non publié en cas d'erreur
        }
      });
    }
    // Mettre à jour la liste des non-publiés en ne gardant que ceux qui étaient déjà là ou qui le sont toujours
    const currentUnpublishedSet = new Set(tempUnpublished);
    stillUnpub = (meta.unpublishedIds || []).filter(id => currentUnpublishedSet.has(id)) // Garde les anciens non publiés qui le sont toujours
                       .concat(tempUnpublished.filter(id => !(meta.unpublishedIds || []).includes(id))); // Ajoute les nouveaux non publiés

    console.log(`🆕  ${publishedIds.length} published / ${stillUnpub.length} still unpublished`);

    // 4. Récupérer les usernames via PortraitNameRegistry
    let usernamesArray = [];
    if (publishedIds.length > 0) {
      const usernamesResults = await client.multicall({
        contracts: [{
          address: CONTRACTS.name,
          abi: [ { "inputs": [ { "internalType": "uint256[]", "name": "portraitIds", "type": "uint256[]" } ], "name": "getNamesForPortraitIds", "outputs": [ { "internalType": "string[]", "name": "names", "type": "string[]" } ], "stateMutability": "view", "type": "function" } ],
          functionName: 'getNamesForPortraitIds',
          args: [publishedIds]
        }]
      });
      if (usernamesResults[0]?.status === 'success') {
        usernamesArray = usernamesResults[0].result;
      } else {
        console.error(`Erreur multicall (usernames):`, usernamesResults[0]?.error);
        usernamesArray = new Array(publishedIds.length).fill(null);
      }
    }

    // 5. REST API (uniquement si CID changé) & nettoyage des <p>…</p>
    for (let i = 0; i < publishedIds.length; i++) {
      const id   = publishedIds[i];
      const user = usernamesArray[i];
      if (!user) {
        console.warn(`Skip ID ${id}: username non récupéré.`);
        continue;
      }

      try {
        const res = await axios.get(PORTRAIT_API + encodeURIComponent(user), {
          timeout: 10_000,
          validateStatus: () => true
        });
        if (res.status === 200 && res.data) {
          const cid   = res.data?.settings?.profile?.avatar?.cid;
          const title = res.data?.settings?.profile?.title || user;
          if (cid && meta.cidMap[id] !== cid) {
            meta.cidMap[id] = cid;
            portraits = portraits
              .filter(p => p.id !== id)
              .concat({
                id,
                username: title.replace(/^<p>/i, '').replace(/<\/p>$/i, '').trim(),
                imageUrl:  IPFS_GATEWAY + cid,
                profileUrl: PUBLIC_PAGE  + user
              });
            console.log('⬆︎  saved', user);
          }
        } else {
          console.warn(`Skip API pour ${user} (ID: ${id}): Status ${res.status}`);
        }
      } catch (apiError) {
          console.error(`Erreur API pour ${user} (ID: ${id}):`, apiError.message);
          // Optionnel: décider si on continue malgré l'erreur API
      }
      await sleep(GAP_MS);
    }

    // -- Ajout Status Succès --
    meta.lastRunStatus = 'success';
    meta.lastRunError = null;
    // -- Fin Ajout --

    // 6. Sauvegarder cache.json & meta.json (déplacé dans finally, mais on garde le log ici)
    console.log(`✅  cache.json (${portraits.length}) & meta.json to be updated`);

  } catch (error) { // <-- Ajout du CATCH
    console.error("❌❌❌ An error occurred during fetch job:", error);
    // -- Ajout Status Erreur --
    meta.lastRunStatus = 'error';
    meta.lastRunError = error.message || 'Unknown error';
    // -- Fin Ajout --
    // On ne quitte plus forcément, le 'finally' s'exécutera
  } finally { // <-- Ajout du FINALLY
    // -- Ajout Timestamp --
    meta.lastRunTimestamp = new Date().toISOString();
    // -- Fin Ajout --

    // La sauvegarde se fait toujours ici
    meta.highestIdSaved = maxId; // Attention: maxId n'est défini que dans le 'try'. On le garde ici, mais si getClient échoue, maxId sera undefined.
    meta.unpublishedIds = stillUnpub; // Idem pour stillUnpub

    try {
      fs.writeFileSync(cacheFilePath, JSON.stringify(portraits, null, 2));
      fs.writeFileSync(metaFilePath,  JSON.stringify(meta,      null, 2));
      console.log(`💾 Files saved. Status: ${meta.lastRunStatus || 'unknown'}`);
    } catch (writeError) {
      console.error("❌ Error writing output files:", writeError);
      // Si l'écriture échoue ici, le statut dans meta.json pourrait ne pas être sauvegardé
    }
  }
})();
// --- Fin du bloc Try/Catch/Finally ---