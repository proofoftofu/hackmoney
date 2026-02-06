import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64 } from '@mysten/sui/utils';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import * as dotenv from 'dotenv';

import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';

dotenv.config();

const PACKAGE_ID = "0xdea9a34e90c69450d02a172b03ebc1be25959a48e4f1e9722f4dbae9d7e4643e";
let CHANNEL_ID: string | null = null; 

const client = new SuiJsonRpcClient({
    network: 'testnet',
    url: getJsonRpcFullnodeUrl('testnet'),
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

    const result = await client.signAndExecuteTransaction({
        transaction: tx,
        signer: sdkKeypair,
    });

    console.log("result", result)

    const transaction = await client.waitForTransaction({
        digest: result.digest,
        options: {
            showEffects: true,
            showObjectChanges: true,
        },
    });

    console.log("transaction", transaction)

    if (transaction.effects?.status.status !== 'success') {
        throw new Error("Transaction execution failed on-chain.");
    }

    const createdObject = transaction.objectChanges?.find(
        (obj: any) => obj.type === 'created' && obj.objectType.includes('::settlement::StateChannel')
    );

    if (createdObject && 'objectId' in createdObject) {
        console.log("✅ Channel Created! CHANNEL_ID:", createdObject.objectId);
        return createdObject.objectId;
    }
    throw new Error("Could not find StateChannel ID in transaction changes.");
}

async function mockStateChannelSettlement(channelId: string) {
    console.log("\n--- Mocking Settlement ---");
    const amount = 888n;
    const bidder = sdkKeypair.getPublicKey().toSuiAddress();
    const message = new TextEncoder().encode(`bid:${amount}`);

    // const { signature } = await sdkKeypair.signPersonalMessage(message);
    // const rawSignature = fromBase64(signature).slice(1, 65);
    const rawSignature = await sdkKeypair.sign(message);


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

    const result = await client.signAndExecuteTransaction({
        transaction: tx,
        signer: sdkKeypair,
    });

    console.log(`✅ Settlement Submitted! Digest: ${result.digest}`);
    
    await client.waitForTransaction({
        digest: result.digest,
        options: { showEffects: true }
    });
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
        await verifyOnChainState(CHANNEL_ID!);
    } catch (err) {
        console.error("Test Error:", err);
    }
}

main();