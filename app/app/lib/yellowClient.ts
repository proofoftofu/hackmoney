import {
  NitroliteClient,
  WalletStateSigner,
  createAuthRequestMessage,
  createAuthVerifyMessageFromChallenge,
  createCreateChannelMessage,
  createECDSAMessageSigner,
  createEIP712AuthMessageSigner,
  createGetConfigMessage,
  createGetLedgerBalancesMessage,
  createResizeChannelMessage,
} from "@erc7824/nitrolite";
import type { RPCAsset, RPCNetworkInfo } from "@erc7824/nitrolite";
import { createPublicClient, http } from "viem";
import type { WalletClient } from "viem";
import { sepolia } from "viem/chains";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export type YellowConnectionConfig = {
  clearnodeUrl: string;
  walletClient: WalletClient;
  address: `0x${string}`;
  application?: string;
  scope?: string;
  allowances?: { asset: string; amount: string }[];
  expiresInSeconds?: number;
};

type Config = {
  assets?: RPCAsset[];
  networks?: RPCNetworkInfo[];
  [key: string]: unknown;
};

type SessionState = {
  ws: WebSocket;
  clearnodeUrl: string;
  walletClient: WalletClient;
  walletAddress: `0x${string}`;
  sessionPrivateKey: `0x${string}`;
  sessionSigner: ReturnType<typeof createECDSAMessageSigner>;
  sessionAddress: `0x${string}`;
  token: `0x${string}`;
  chainId: number;
  channelId?: `0x${string}`;
  config?: Config;
};

let activeSession: SessionState | null = null;

const DEFAULT_TOKEN = "0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb";

const ALCHEMY_RPC_URL = process.env.ALCHEMY_RPC_URL;
const FALLBACK_RPC_URL = 'https://1rpc.io/sepolia'; // Public fallback

const ensureBrowser = () => {
  if (typeof window === "undefined") {
    throw new Error("Yellow client can only run in the browser.");
  }
};

const log = (...args: unknown[]) => {
  console.log("[yellowClient]", ...args);
};

const waitForOpen = (ws: WebSocket) =>
  new Promise<void>((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }
    const handleOpen = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Failed to open WebSocket connection."));
    };
    const cleanup = () => {
      ws.removeEventListener("open", handleOpen);
      ws.removeEventListener("error", handleError);
    };
    ws.addEventListener("open", handleOpen);
    ws.addEventListener("error", handleError);
  });

const waitForResponse = (
  ws: WebSocket,
  expectedMethod: string | string[],
  timeoutMs = 20000
) =>
  new Promise<any>((resolve, reject) => {
    const expected = Array.isArray(expectedMethod)
      ? expectedMethod
      : [expectedMethod];
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for ${expected.join(" / ")}.`));
    }, timeoutMs);

    const handler = (event: MessageEvent) => {
      try {
        const message = JSON.parse(String(event.data));
        if (message?.error) {
          cleanup();
          reject(new Error(message.error.message || "RPC error"));
          return;
        }
        const method = message?.method ?? message?.res?.[1];
        if (!expected.includes(method)) return;
        cleanup();
        resolve(message);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      ws.removeEventListener("message", handler);
    };

    ws.addEventListener("message", handler);
  });

const fetchConfig = async (
  ws: WebSocket,
  sessionSigner: ReturnType<typeof createECDSAMessageSigner>
) => {
  log("Requesting config...");
  const configMsg = await createGetConfigMessage(sessionSigner);
  ws.send(configMsg);
  const response = await waitForResponse(ws, ["get_config", "config"]);
  log("Config received.");
  return (response?.res?.[2] ?? {}) as Config;
};

const resolveToken = (config: Config | undefined, chainId: number) => {
  const assets = config?.assets ?? [];
  const match = assets.find((asset) => asset.chain_id === chainId);
  return (match?.token ?? DEFAULT_TOKEN) as `0x${string}`;
};

const resolveNetwork = (config: Config | undefined, chainId: number) => {
  const networks = config?.networks ?? [];
  return networks.find((network: any) => (network.chain_id ?? network.chainId) === chainId);
};

const toBigInt = (value: unknown) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string" && value !== "") return BigInt(value);
  return 0n;
};

const ensureSession = () => {
  if (!activeSession) {
    throw new Error("Yellow session not initialized. Call openChannel first.");
  }
  return activeSession;
};

export async function openChannel(config: YellowConnectionConfig): Promise<string> {
  ensureBrowser();

  if (activeSession?.channelId) {
    log("Reusing active channel:", activeSession.channelId);
    return activeSession.channelId;
  }

  const chainId = config.walletClient.chain?.id ?? sepolia.id;
  log("Opening channel on chain:", chainId);

  const sessionPrivateKey = generatePrivateKey();
  const sessionAccount = privateKeyToAccount(sessionPrivateKey);
  const sessionSigner = createECDSAMessageSigner(sessionPrivateKey);
  log("Generated session key:", sessionAccount.address);

  const ws = new WebSocket(config.clearnodeUrl);
  log("Connecting to clearnode:", config.clearnodeUrl);
  await waitForOpen(ws);
  log("Clearnode connected.");

  const sessionState: SessionState = {
    ws,
    clearnodeUrl: config.clearnodeUrl,
    walletClient: config.walletClient,
    walletAddress: config.address,
    sessionPrivateKey,
    sessionSigner,
    sessionAddress: sessionAccount.address,
    token: DEFAULT_TOKEN,
    chainId,
  };

  sessionState.config = await fetchConfig(ws, sessionSigner);
  sessionState.token = resolveToken(sessionState.config, chainId);
  log("Resolved token:", sessionState.token);

  const authParams = {
    session_key: sessionState.sessionAddress,
    allowances: config.allowances ?? [
      {
        asset: "ytest.usd",
        amount: "1000000000",
      },
    ],
    expires_at: BigInt(
      Math.floor(Date.now() / 1000) + (config.expiresInSeconds ?? 3600)
    ),
    scope: config.scope ?? "auction.app",
  };

  const authRequest = await createAuthRequestMessage({
    address: config.address,
    application: config.application ?? "Yellow Auction",
    ...authParams,
  });

  log("Sending auth_request...");
  ws.send(authRequest);

  const challenge = await waitForResponse(ws, "auth_challenge");
  const challengeMessage = challenge?.res?.[2]?.challenge_message;
  if (!challengeMessage) {
    throw new Error("Missing auth challenge from Yellow.");
  }
  log("Received auth_challenge.");

  const authSigner = createEIP712AuthMessageSigner(
    config.walletClient,
    authParams,
    { name: config.application ?? "Yellow Auction" }
  );

  const verifyMsg = await createAuthVerifyMessageFromChallenge(
    authSigner,
    challengeMessage
  );

  log("Sending auth_verify (EIP-712)...");
  ws.send(verifyMsg);
  await waitForResponse(ws, "auth_verify");
  log("Authenticated.");

  const ledgerMsg = await createGetLedgerBalancesMessage(
    sessionSigner,
    config.address,
    Date.now()
  );
  log("Requesting ledger balances (channels)...");
  ws.send(ledgerMsg);
  const channelsResp = await waitForResponse(ws, "channels");
  const channels = channelsResp?.res?.[2]?.channels ?? [];
  const openChannel = channels.find((channel: any) => channel.status === "open");

  if (openChannel?.channel_id) {
    sessionState.channelId = openChannel.channel_id as `0x${string}`;
    log("Found open channel:", sessionState.channelId);
    activeSession = sessionState;
    return sessionState.channelId;
  }

  log("No open channel. Creating new channel...");
  const createChannel = await createCreateChannelMessage(sessionSigner, {
    chain_id: chainId,
    token: sessionState.token,
  });
  console.log("DEBUG: Sending create_channel payload:", JSON.stringify(createChannel));
  ws.send(createChannel);
  const created = await waitForResponse(ws, "create_channel");
  const createParams = created?.res?.[2];
  if (!createParams) {
    throw new Error("Yellow did not return create_channel params.");
  }

  const rawChannelId =
    (createParams.channel_id ?? createParams.channelId) as `0x${string}` | undefined;
  const rawServerSignature =
    (createParams.server_signature ?? createParams.serverSignature) as
      | `0x${string}`
      | undefined;
  const rawState = createParams.state ?? {};
  const rawChannel = createParams.channel ?? {};
  const stateData = rawState.state_data ?? rawState.stateData;
  const allocations = Array.isArray(rawState.allocations)
    ? rawState.allocations
    : [];

  if (!rawChannelId || !rawServerSignature || !stateData) {
    throw new Error("Yellow create_channel response missing required data.");
  }

  const network = resolveNetwork(sessionState.config, chainId);
  const custody = network?.custody_address ?? network?.custodyAddress;
  const adjudicator = network?.adjudicator_address ?? network?.adjudicatorAddress;
  if (!custody || !adjudicator) {
    throw new Error("Missing custody/adjudicator addresses for selected chain.");
  }

  const publicClient = createPublicClient({
    chain: sessionState.walletClient.chain ?? sepolia,
    transport: http(ALCHEMY_RPC_URL || FALLBACK_RPC_URL),
  });

  const challengeDuration = BigInt(
    Math.max(3600, Number(rawChannel.challenge ?? rawChannel.challengeDuration ?? 0))
  );

  const nitroliteClient = new NitroliteClient({
    publicClient,
    walletClient: sessionState.walletClient,
    stateSigner: new WalletStateSigner(sessionState.walletClient),
    addresses: {
      custody,
      adjudicator,
    },
    chainId,
    challengeDuration,
  });

  log("Submitting on-chain createChannel...");
  const onChainResult = await nitroliteClient.createChannel({
    channel: {
      participants: rawChannel.participants ?? [],
      adjudicator,
      challenge: toBigInt(rawChannel.challenge),
      nonce: toBigInt(rawChannel.nonce),
    },
    unsignedInitialState: {
      intent: Number(rawState.intent ?? 0),
      version: toBigInt(rawState.version),
      data: stateData,
      allocations: allocations.map((allocation: any) => ({
        destination: allocation.destination,
        token: allocation.token,
        amount: toBigInt(allocation.amount),
      })),
    },
    serverSignature: rawServerSignature,
  });

  sessionState.channelId = onChainResult.channelId as `0x${string}`;
  log("Channel created on-chain:", sessionState.channelId, "tx:", onChainResult.txHash);
  activeSession = sessionState;
  return sessionState.channelId;
}

export async function signSessionMessage(payload: string): Promise<string> {
  const session = ensureSession();
  log("Signing session payload.");
  return session.sessionSigner(payload);
}

export async function deposit(amount: number): Promise<void> {
  const session = ensureSession();

  const rounded = Math.max(0, Math.round(amount * 100));
  if (rounded === 0) return;

  log("Depositing (allocate_amount):", rounded);
  const resizeMsg = await createResizeChannelMessage(session.sessionSigner, {
    channel_id: session.channelId as `0x${string}`,
    allocate_amount: BigInt(rounded),
    funds_destination: session.walletAddress,
  });

  session.ws.send(resizeMsg);
  await waitForResponse(session.ws, "resize_channel");
  log("Deposit confirmed.");
}

export async function withdraw(amount: number): Promise<void> {
  void amount;
  console.warn(
    "Withdraw flow requires on-chain close/withdraw. Not implemented in the browser client yet."
  );
}
