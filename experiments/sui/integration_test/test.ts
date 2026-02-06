import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { fromBase64 } from '@mysten/sui/utils';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import * as dotenv from 'dotenv';

dotenv.config();

// 1. CONFIGURATION
const PACKAGE_ID = "0xdea9a34e90c69450d02a172b03ebc1be25959a48e4f1e9722f4dbae9d7e4643e";
let CHANNEL_ID: string | null = null; 

const client = new SuiGrpcClient({
    network: 'testnet',
    baseUrl: 'https://fullnode.testnet.sui.io:443',
});

if (!process.env.SUI_PRIVATE_KEY) throw new Error("Missing SUI_PRIVATE_KEY in .env");
const { secretKey } = decodeSuiPrivateKey(process.env.SUI_PRIVATE_KEY);
const sdkKeypair = Ed25519Keypair.fromSecretKey(secretKey);

async function initializeChannel() {
    console.log("--- Initializing State Channel ---");
    const tx = new Transaction();
    const pubKeyBytes = sdkKeypair.getPublicKey().toRawBytes();

    tx.moveCall({
        target: `${PACKAGE_ID}::settlement::create_channel`,
        arguments: [tx.pure.vector('u8', Array.from(pubKeyBytes))],
    });

    const result = await client.signAndExecuteTransaction({ signer: sdkKeypair, transaction: tx });
    const digest = result.$kind === 'Transaction' ? result.Transaction.digest : "";
    
    console.log(`Transaction submitted: ${digest}. Waiting 5 seconds for indexing...`);
    await new Promise(res => setTimeout(res, 5000)); // Simple wait as requested

    const txDetails = await client.getTransaction({
        digest: digest,
        options: { showObjectChanges: true, showEffects: true }
    });

    if (txDetails?.$kind !== 'Transaction' || !txDetails.Transaction.status?.success) {
        throw new Error("Transaction failed or not found.");
    }

    // Find the object from changes
    const createdObject = txDetails.Transaction.objectChanges?.find(
        (obj: any) => obj.type === 'created' && obj.objectType.includes('::settlement::StateChannel')
    );

    if (createdObject && 'objectId' in createdObject) {
        console.log("✅ Channel Created! CHANNEL_ID:", createdObject.objectId);
        return createdObject.objectId;
    }
    throw new Error("Could not find StateChannel ID in transaction effects.");
}

async function mockStateChannelSettlement(channelId: string) {
    console.log("\n--- Mocking Settlement ---");
    const amount = 888n; // Lucky number bid
    const bidder = sdkKeypair.getPublicKey().toSuiAddress();
    const message = new TextEncoder().encode(`bid:${amount}`);

    const { signature } = await sdkKeypair.signPersonalMessage(message);
    const rawSignature = fromBase64(signature).slice(1, 65);

    const tx = new Transaction();
    tx.moveCall({
        target: `${PACKAGE_ID}::settlement::verify_bid`,
        arguments: [
            tx.object(channelId),
            tx.pure.vector('u8', Array.from(rawSignature)),
            tx.pure.vector('u8', Array.from(message)),
            tx.pure.address(bidder),
            tx.pure.u64(amount),
        ],
    });

    const result = await client.signAndExecuteTransaction({ signer: sdkKeypair, transaction: tx });
    if (result.$kind === 'Transaction') {
        console.log(`✅ Settlement Submitted! Digest: ${result.Transaction.digest}`);
    }
}

async function verifyOnChainState(channelId: string) {
    console.log("\n--- Verifying On-Chain State ---");
    const object = await client.getObject({
        id: channelId,
        options: { showContent: true }
    });

    if (object.data?.content?.dataType === 'moveObject') {
        const fields = object.data.content.fields as any;
        console.log(`Latest Bid: ${fields.latest_bid}`);
        console.log(`Top Bidder: ${fields.top_bidder}`);
    }
}

async function main() {
    try {
        if (!CHANNEL_ID) {
            CHANNEL_ID = await initializeChannel();
        }
        await mockStateChannelSettlement(CHANNEL_ID!);
        await new Promise(res => setTimeout(res, 5000)); // Wait for settlement to index
        await verifyOnChainState(CHANNEL_ID!);
    } catch (err) {
        console.error("Test Error:", err);
    }
}

main();
