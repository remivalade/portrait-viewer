// backend/verify-count.js (Version Corrigée)
import { createPublicClient, http } from 'viem';
import { defineChain } from 'viem/utils';

console.log("🔍 Starting On-Chain Published Portrait Count Verification (v2)...");

// --- Configuration ---
const RPC_URLS = [
  'https://sepolia.base.org',
  'https://1rpc.io/base-sepolia',
  'https://base-sepolia.blockpi.network/v1/rpc/public'
];
const BaseSepoliaChain = defineChain({
  id: 84531, name: 'Base Sepolia', network: 'base-sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: RPC_URLS } },
  contracts: { multicall3: { address: '0xca11bde05977b3631167028862be2a173976ca11', blockCreated: 11907934 } }
});
const CONTRACTS = {
  id:    '0x3cDc03BEb79ba3b9FD3b687C67BFDE70AFf46eBF', // PortraitIdRegistryV2
  state: '0x320C9E64c9a68492A1EB830e64EE881D75ac5efd'  // PortraitStateRegistry
};
const BATCH = 50; // Garder une taille de lot réduite
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
// --- Fin Configuration ---

// --- ABIs Minimales Nécessaires ---
const IdRegistryABI = [
    { "inputs": [], "name": "portraitIdCounter", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" },
    // --- MODIFICATION: Utiliser l'ABI du getter pour le mapping portraitIdToOwner ---
    { "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "name": "portraitIdToOwner", "outputs": [{"internalType": "address", "name": "", "type": "address"}], "stateMutability": "view", "type": "function" }
    // --- FIN MODIFICATION ---
    // { "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}], "name": "ownerOf", "outputs": [{"internalType": "address", "name": "", "type": "address"}], "stateMutability": "view", "type": "function" } // Commenté/Supprimé
];
const StateRegistryABI = [
    { "inputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "name": "portraitIdToPortraitHash", "outputs": [ { "internalType": "string", "name": "", "type": "string" } ], "stateMutability": "view", "type": "function" }
];
// --- Fin ABIs ---

// --- Fonction getClient ---
async function getClient() {
  // ... (Code inchangé) ...
}
// --- Fin getClient ---

// --- Logique Principale de Vérification ---
(async () => {
  let publishedCount = 0;
  let totalChecked = 0;
  let client;

  try {
    client = await getClient();

    const maxIdBigInt = await client.readContract({
      address: CONTRACTS.id,
      abi: IdRegistryABI,
      functionName: 'portraitIdCounter'
    });
    const maxId = Number(maxIdBigInt);
    console.log(`📈 Max ID found: ${maxId}`);
    if (maxId === 0) {
        console.log("Max ID is 0, nothing to check.");
        return;
    }

    console.log(`🔄 Checking IDs from 1 to ${maxId} in batches of ${BATCH}...`);

    for (let i = 1; i <= maxId; i += BATCH) {
      const endId = Math.min(i + BATCH - 1, maxId);
      const idsInBatch = [];
      for (let j = i; j <= endId; j++) { idsInBatch.push(j); }
      totalChecked += idsInBatch.length;

      // --- MODIFICATION: Appeler portraitIdToOwner au lieu de ownerOf ---
      const multicallContracts = idsInBatch.flatMap(id => [
        {
          address: CONTRACTS.id,
          abi: IdRegistryABI,
          functionName: 'portraitIdToOwner', // Utiliser le getter du mapping
          args: [BigInt(id)] // Assurer que l'ID est un BigInt pour viem
        },
        {
          address: CONTRACTS.state,
          abi: StateRegistryABI,
          functionName: 'portraitIdToPortraitHash',
          args: [BigInt(id)] // Assurer que l'ID est un BigInt pour viem
        }
      ]);
      // --- FIN MODIFICATION ---

      const results = await client.multicall({ contracts: multicallContracts, allowFailure: true });

      // Traiter les résultats par paires
      for (let k = 0; k < results.length; k += 2) {
        const ownerResult = results[k];
        const hashResult = results[k + 1];
        const currentId = idsInBatch[k / 2];

        let hasOwner = false;
        let hasHash = false;

        // Vérifier le résultat portraitIdToOwner
        // Cette fonction ne devrait pas échouer sauf problème RPC/contrat grave
        if (ownerResult.status === 'success' && ownerResult.result !== ZERO_ADDRESS) {
            hasOwner = true;
        } else if (ownerResult.status === 'failure') {
            console.warn(`Warn: portraitIdToOwner failed for ID ${currentId}`, ownerResult.error?.shortMessage || ownerResult.error);
        }

        // Vérifier le résultat du hash
        if (hashResult.status === 'success' && hashResult.result && hashResult.result !== '') {
            hasHash = true;
        } else if (hashResult.status === 'failure') {
             console.warn(`Warn: portraitIdToPortraitHash failed for ID ${currentId}`, hashResult.error?.shortMessage || hashResult.error);
        }

        // Incrémenter si les DEUX sont vrais
        if (hasOwner && hasHash) {
          publishedCount++;
        }
      }
      console.log(`   ... checked up to ID ${endId}. Current published count: ${publishedCount}`);
    }

    console.log("\n-----------------------------------------");
    console.log(`✅ Verification Complete!`);
    console.log(`   Total IDs Checked: ${totalChecked}`);
    console.log(`   Total Published Portraits Found (On-Chain): ${publishedCount}`);
    console.log("-----------------------------------------");

  } catch (error) {
    console.error("\n❌❌❌ An error occurred during verification:", error);
  }
})();
// --- Fin Logique Principale ---