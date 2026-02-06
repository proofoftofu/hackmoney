import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { fromB64 } from '@mysten/sui/utils';

// 1. Setup constants (Replace these after you publish your contract)
const PACKAGE_ID = "0xYOUR_PACKAGE_ID"; 
const CHANNEL_ID = "0xYOUR_SHARED_OBJECT_ID"; 

const client = new SuiClient({ url: getFullnodeUrl('localnet') });

// The "Yellow SDK" keypair that signed the state channel object on creation
const sdkKeypair = new Ed25519Keypair(); 

async function mockStateChannelSettlement() {
    // 2. The data we want to "settle" on-chain
    const amount = 500n;
    const bidder = "0x0000000000000000000000000000000000000000000000000000000000001337";
    
    // Create the raw message exactly as it will be verified
    // For a real app, you might use BCS to serialize a struct
    const message = new TextEncoder().encode(`bid:${amount}`);

    // 3. MOCK YELLOW SDK: Sign the message off-chain
    // We use signPersonalMessage which wraps the data to prevent replay attacks
    const { signature } = await sdkKeypair.signPersonalMessage(message);
    
    // Sui's ed25519_verify expects the raw 64-byte signature
    // signPersonalMessage returns a serialized signature (flag + sig + pubkey)
    // We need to extract just the 64-byte signature part
    const rawSignature = fromB64(signature).slice(1, 65);

    console.log("Submitting settlement transaction to Sui...");

    // 4. Create the Programmable Transaction Block
    const tx = new Transaction();
    
    tx.moveCall({
        target: `${PACKAGE_ID}::settlement::verify_bid`,
        arguments: [
            tx.object(CHANNEL_ID),                // channel: &mut StateChannel
            tx.pure.vector('u8', rawSignature),   // signature: vector<u8>
            tx.pure.vector('u8', message),        // message: vector<u8>
            tx.pure.address(bidder),              // bidder: address
            tx.pure.u64(amount),                  // amount: u64
        ],
    });

    // 5. Execute with a gas-paying account
    try {
        const result = await client.signAndExecuteTransaction({ 
            signer: sdkKeypair, 
            transaction: tx,
            options: { showEvents: true, showEffects: true }
        });
        
        console.log("Success! Transaction Digest:", result.digest);
        console.log("State updated on-chain.");
    } catch (e) {
        console.error("Verification failed! Signature likely invalid.", e);
    }
}

mockStateChannelSettlement();
