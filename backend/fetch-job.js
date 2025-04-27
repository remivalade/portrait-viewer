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
// Correction : Ajout de la configuration multicall3
const BaseSepoliaChain = {
  id: 84531,
  name: 'Base Sepolia',
  network: 'base-sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: RPC_URLS } },
  contracts: {
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 11907934, // Block approx. de déploiement sur Sepolia (pas critique ici)
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

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Charger cache + meta
let portraits = [];
try { portraits = JSON.parse(fs.readFileSync('./backend/cache.json')); } catch {}
let meta = { highestIdSaved: 0, unpublishedIds: [], cidMap: {} };
try { meta = JSON.parse(fs.readFileSync('./backend/meta.json')); } catch {}

// Essayer chaque RPC et créer un client viem
async function getClient() {
  for (const url of RPC_URLS) {
    const client = createPublicClient({
      chain: BaseSepoliaChain,
      transport: http(url)
    });
    try {
      await client.getBlockNumber();
      console.log('🛰️  RPC OK →', url);
      return client;
    } catch {
      console.warn('RPC down →', url);
    }
  }
  throw new Error('No RPC reachable');
}

(async () => {
  const client = await getClient();

  // 1. IDs candidats (nouveaux + toujours non publiés)
  const maxId = Number(
    await client.readContract({
      address: CONTRACTS.id,
      // Correction : Format ABI JSON
      abi: [
        {
          "inputs": [],
          "name": "portraitIdCounter",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        }
      ],
      functionName: 'portraitIdCounter'
    })
  );
  const newIds = [];
  for (let i = meta.highestIdSaved + 1; i <= maxId; i++) newIds.push(i);
  const candidateIds = newIds.concat(meta.unpublishedIds);
  if (candidateIds.length === 0) {
    console.log('✅  Nothing new to sync');
    return;
  }
  console.log(`🔍  Checking ${candidateIds.length} candidate IDs`);

  // 2. Filtrer ceux qui ont un owner
  const idsWithOwner = [];
  for (let i = 0; i < candidateIds.length; i += BATCH) {
    const chunk = candidateIds.slice(i, i + BATCH);

    // ----- MODIFICATION POUR CORRIGER owners.forEach -----
    // Récupérer le tableau complet des résultats du multicall
    const ownersResults = await client.multicall({
      contracts: [{
        address: CONTRACTS.id,
        // Correction : Format ABI JSON
        abi: [
          {
            "inputs": [
              {
                "internalType": "uint256[]",
                "name": "portraitIds",
                "type": "uint256[]"
              }
            ],
            "name": "getOwnersForPortraitIds",
            "outputs": [
              {
                "internalType": "address[]",
                "name": "owners",
                "type": "address[]"
              }
            ],
            "stateMutability": "view",
            "type": "function"
          }
        ],
        functionName: 'getOwnersForPortraitIds',
        args: [chunk]
      }]
    });

    // Vérifier le statut et extraire le tableau de résultats si succès
    if (ownersResults[0]?.status === 'success') {
        const ownersArray = ownersResults[0].result; // Ceci est le vrai tableau d'adresses
        // Utiliser ownersArray pour la boucle forEach
        ownersArray.forEach((owner, j) => {
          if (owner !== '0x0000000000000000000000000000000000000000') {
            idsWithOwner.push(chunk[j]);
          }
        });
    } else {
      // Gestion d'erreur si l'appel a échoué
      console.error(`Erreur lors de la récupération des owners pour le chunk ${i}:`, ownersResults[0]?.error);
    }
    // ----- FIN DE LA MODIFICATION -----
  }

  // 3. Check “published?” via PortraitStateRegistry
  const publishedIds = [];
  const stillUnpub   = [];
  for (let i = 0; i < idsWithOwner.length; i += BATCH) {
    const chunk = idsWithOwner.slice(i, i + BATCH);
    const hashesResults = await client.multicall({ // Renommé en hashesResults pour clarté
      contracts: chunk.map(id => ({
        address: CONTRACTS.state,
        // Correction : Format ABI JSON
        abi: [
         {
           "inputs": [
             {
               "internalType": "uint256",
               "name": "",
               "type": "uint256"
             }
           ],
           "name": "portraitIdToPortraitHash",
           "outputs": [
             {
               "internalType": "string",
               "name": "",
               "type": "string"
             }
           ],
           "stateMutability": "view",
           "type": "function"
         }
       ],
        functionName: 'portraitIdToPortraitHash',
        args: [id]
      }))
    });

    // ----- MODIFICATION SIMILAIRE POUR hashes.forEach -----
    // Traiter chaque résultat du multicall pour les hashes
    hashesResults.forEach((resultObj, idx) => {
      if (resultObj?.status === 'success') {
        // Vérifier si le hash (le résultat) n'est pas vide
        if (resultObj.result) {
          publishedIds.push(chunk[idx]);
        } else {
          stillUnpub.push(chunk[idx]);
        }
      } else {
        console.error(`Erreur lors de la récupération du hash pour l'ID ${chunk[idx]}:`, resultObj?.error);
        stillUnpub.push(chunk[idx]); // On considère comme non publié en cas d'erreur
      }
    });
    // ----- FIN DE LA MODIFICATION -----
  }
  console.log(`🆕  ${publishedIds.length} published / ${stillUnpub.length} still unpublished`);

  // 4. Récupérer les usernames via PortraitNameRegistry
  let usernamesArray = []; // Renommé pour clarté
  if (publishedIds.length > 0) {
    // ----- MODIFICATION SIMILAIRE POUR usernames -----
    const usernamesResults = await client.multicall({
      contracts: [{
        address: CONTRACTS.name,
        // Correction : Format ABI JSON
        abi: [
          {
            "inputs": [
              {
                "internalType": "uint256[]",
                "name": "portraitIds",
                "type": "uint256[]"
              }
            ],
            "name": "getNamesForPortraitIds",
            "outputs": [
              {
                "internalType": "string[]",
                "name": "names",
                "type": "string[]"
              }
            ],
            "stateMutability": "view",
            "type": "function"
          }
        ],
        functionName: 'getNamesForPortraitIds',
        args: [publishedIds]
      }]
    });

    if (usernamesResults[0]?.status === 'success') {
      usernamesArray = usernamesResults[0].result; // Le vrai tableau de usernames
    } else {
      console.error(`Erreur lors de la récupération des usernames:`, usernamesResults[0]?.error);
      // Initialiser un tableau vide ou de la bonne taille avec des valeurs nulles si nécessaire
      usernamesArray = new Array(publishedIds.length).fill(null);
    }
    // ----- FIN DE LA MODIFICATION -----
  }

  // 5. REST API (uniquement si CID changé) & nettoyage des <p>…</p>
  for (let i = 0; i < publishedIds.length; i++) {
    const id   = publishedIds[i];
    const user = usernamesArray[i]; // Utiliser usernamesArray
    if (!user) {
      console.warn(`Skip ID ${id}: username non récupéré.`);
      continue;
    }

    try {
      const res = await axios.get(PORTRAIT_API + encodeURIComponent(user), {
        timeout: 10_000,
        validateStatus: () => true
      });
      if (res.status === 200 && res.data) { // Vérifier aussi res.data
        const cid   = res.data?.settings?.profile?.avatar?.cid;
        const title = res.data?.settings?.profile?.title || user;
        if (cid && meta.cidMap[id] !== cid) {
          meta.cidMap[id] = cid;
          portraits = portraits
            .filter(p => p.id !== id)
            .concat({
              id,
              // Correction mineure de la regex pour être plus robuste
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
    }
    await sleep(GAP_MS);
  }

  // 6. Sauvegarder cache.json & meta.json
  meta.highestIdSaved = maxId;
  meta.unpublishedIds = stillUnpub;
  try {
    fs.writeFileSync('./backend/cache.json', JSON.stringify(portraits, null, 2));
    fs.writeFileSync('./backend/meta.json',  JSON.stringify(meta,      null, 2));
    console.log(`✅  cache.json (${portraits.length}) & meta.json updated`);
  } catch (writeError) {
    console.error("Erreur lors de l'écriture des fichiers de sortie:", writeError);
  }
})();