import { AuthChallengeResponse, createAuthRequestMessage, createEIP712AuthMessageSigner, createAuthVerifyMessage, RPCResponse, RPCMethod } from '@erc7824/nitrolite';
import { Client } from 'yellow-ts';

import { createWalletClient, http, WalletClient } from 'viem'
import { sepolia } from 'viem/chains'
import { generateSessionKey, SessionKey } from './utils';

import { config } from 'dotenv'

config()

const AUTH_SCOPE = 'test.app';

const APP_NAME = 'Test app';

const SESSION_DURATION = 3600; // 1 hour

export async function authenticateWallet(client: Client, walletAccount: WalletClient): Promise<SessionKey> {

    console.log(`Wallet address: ${walletAccount.account?.address}`);

    const sessionKey = generateSessionKey();

    const sessionExpireTimestamp = String(Math.floor(Date.now() / 1000) + SESSION_DURATION);

    const customWalletClient = createWalletClient({
        account: walletAccount.account,
        chain: sepolia,
        transport: http(),
    });

    // Create authentication message with session configuration
    const authMessage = await createAuthRequestMessage({
        address: walletAccount.account?.address as `0x${string}`,
        session_key: sessionKey.address,
        application: 'Test app',
        allowances: [{
            asset: 'ytest.usd',
            amount: '1',
        }],
        expires_at: BigInt(sessionExpireTimestamp),
        scope: 'test.app',
    });

    async function handleAuthChallenge(message: AuthChallengeResponse) {

        const authParams = {
            scope: 'test.app',
            application: walletAccount.account?.address as `0x${string}`,
            participant: sessionKey.address,
            expire: sessionExpireTimestamp,
            allowances: [{
                asset: 'ytest.usd',
                amount: '1',
            }],
            session_key: sessionKey.address,
            expires_at: BigInt(sessionExpireTimestamp),
        };

        const eip712Signer = createEIP712AuthMessageSigner(customWalletClient, authParams, { name: APP_NAME });

        const authVerifyMessage = await createAuthVerifyMessage(eip712Signer, message);

        await client.sendMessage(authVerifyMessage);

    }

    client.listen(async (message: RPCResponse) => {
        console.log("debug: client.listen", message)


        if (message.method === RPCMethod.AuthChallenge) {
            await handleAuthChallenge(message);
        }
    })

    await client.sendMessage(authMessage)

    return sessionKey;

}