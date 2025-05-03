// backend/verify-count.js (Version Finale Fonctionnelle)
import { createPublicClient, http } from 'viem';
import { defineChain } from 'viem/utils';

console.log("🔍 Starting On-Chain Published Portrait Count Verification (Final)...");

// --- Configuration ---
const RPC_URL_TO_TEST = 'https://sepolia.base.org'; // Utiliser un RPC fiable
const BaseSepoliaChain = defineChain({
  id: 84531, name: 'Base Sepolia', network: 'base-sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL_TO_TEST] } },
  contracts: { multicall3: { address: '0xca11bde05977b3631167028862be2a173976ca11', blockCreated: 11907934 } }
});
const CONTRACTS = {
  id:    '0x3cDc03BEb79ba3b9FD3b687C67BFDE70AFf46eBF', // PortraitIdRegistryV2
  state: '0x320C9E64c9a68492A1EB830e64EE881D75ac5efd'  // PortraitStateRegistry
};
const BATCH = 50; // Garder une taille de lot réduite qui avait fonctionné
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
// --- Fin Configuration ---

// --- ABIs Minimales Nécessaires ---
const IdRegistryABI = [
    { "inputs": [], "name": "portraitIdCounter", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" },
    { "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "name": "portraitIdToOwner", "outputs": [{"internalType": "address", "name": "", "type": "address"}], "stateMutability": "view", "type": "function" }
];
const StateRegistryABI = [
    { "inputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "name": "portraitIdToPortraitHash", "outputs": [ { "internalType": "string", "name": "", "type": "string" } ], "stateMutability": "view", "type": "function" }
];
// --- Fin ABIs ---

// --- Fonction getClient (Version Robuste) ---
async function getClient() {
  console.log(`[getClient] Attempting to connect directly to: ${RPC_URL_TO_TEST}`);
  let client;
  try {
      console.log("[getClient] Before createPublicClient...");
      client = createPublicClient({
          chain: BaseSepoliaChain,
          transport: http(RPC_URL_TO_TEST, { timeout: 20000 })
      });
      console.log("[getClient] After createPublicClient. Client object type:", typeof client);

      if (!client || typeof client.getBlockNumber !== 'function') {
           console.error("❌ [getClient] createPublicClient did not return a valid client.");
           throw new Error("createPublicClient failed silently or returned invalid object.");
      }

      console.log("[getClient] Before getBlockNumber...");
      const blockNumber = await client.getBlockNumber({ maxAge: 0 });
      console.log(`✅ [getClient] RPC Connection OK (Block: ${blockNumber})`);
      console.log("[getClient] END - Returning client.");
      return client;

  } catch (err) {
      console.error(`❌ [getClient] Error caught within getClient function: ${err.name}: ${err.message}`);
      // console.error("[getClient] Error stack:", err.stack); // Décommenter si besoin de plus de détails
      throw err; // Propager l'erreur
  }
}
// --- Fin getClient ---

// --- Logique Principale de Vérification ---
(async () => {
  let publishedCount = 0;
  let totalChecked = 0;
  let client;

  try {
    console.log("[Main] Before calling getClient...");
    client = await getClient();
    console.log("[Main] After calling getClient. Client type:", typeof client);

    if (!client || typeof client.readContract !== 'function') {
        throw new Error("[Main] getClient did not return a valid client object.");
    }
    console.log("[Main] Client object validated. Before calling client.readContract..."); // Log ajouté

    const maxIdBigInt = await client.readContract({ // Devrait fonctionner maintenant
      address: CONTRACTS.id,
      abi: IdRegistryABI,
      functionName: 'portraitIdCounter'
    });
    const maxId = Number(maxIdBigInt);
    console.log(`📈 Max ID found: ${maxId}`);
    if (maxId === 0) { console.log("Max ID is 0, nothing to check."); return; }

    console.log(`🔄 Checking IDs from 1 to ${maxId} in batches of ${BATCH}...`);

    for (let i = 1; i <= maxId; i += BATCH) {
      const endId = Math.min(i + BATCH - 1, maxId);
      const idsInBatch = Array.from({ length: endId - i + 1 }, (_, k) => BigInt(i + k));
      totalChecked += idsInBatch.length;

      const multicallContracts = idsInBatch.flatMap(id => [
        { address: CONTRACTS.id, abi: IdRegistryABI, functionName: 'portraitIdToOwner', args: [id] },
        { address: CONTRACTS.state, abi: StateRegistryABI, functionName: 'portraitIdToPortraitHash', args: [id] }
      ]);

      // Mettre un try/catch autour du multicall au cas où LUI échouerait
      let results = [];
      try {
           results = await client.multicall({ contracts: multicallContracts, allowFailure: true });
      } catch(multiErr) {
           console.error(`❌ Error during multicall for batch starting at ID ${i}:`, multiErr);
           continue; // Passer au batch suivant en cas d'erreur grave multicall
      }


      for (let k = 0; k < results.length; k += 2) {
        const ownerResult = results[k];
        const hashResult = results[k + 1];
        const currentId = Number(idsInBatch[k / 2]);

        let hasOwner = (ownerResult?.status === 'success' && ownerResult.result !== ZERO_ADDRESS);
        let hasHash = (hashResult?.status === 'success' && hashResult.result && hashResult.result !== '');

        // Log des erreurs individuelles dans le batch (optionnel, peut être bruyant)
        // if (ownerResult?.status === 'failure') console.warn(`Warn: portraitIdToOwner failed for ID ${currentId}`, ownerResult.error?.shortMessage || ownerResult.error);
        // if (hashResult?.status === 'failure') console.warn(`Warn: portraitIdToPortraitHash failed for ID ${currentId}`, hashResult.error?.shortMessage || hashResult.error);

        if (hasOwner && hasHash) publishedCount++;
      }
      console.log(`   ... checked up to ID ${endId}. Current published count: ${publishedCount}`);
    }

    console.log("\n-----------------------------------------");
    console.log(`✅ Verification Complete!`);
    console.log(`   Total IDs Checked: ${totalChecked}`);
    console.log(`   Total Published Portraits Found (On-Chain): ${publishedCount}`);
    console.log("-----------------------------------------");

  } catch (error) {
    // Afficher l'erreur principale qui a stoppé le processus
    console.error("\n❌❌❌ An error occurred during verification:", error.message);
     console.error("Stack Trace:", error.stack); // Afficher la stack trace complète
  }
})();
// --- Fin Logique Principale ---