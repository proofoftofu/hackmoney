import type {
  RPCAsset,
  RPCNetworkInfo,
  createECDSAMessageSigner,
} from "@erc7824/nitrolite";
import type { WalletClient } from "viem";

export type YellowConnectionConfig = {
  clearnodeUrl: string;
  walletClient: WalletClient;
  address: `0x${string}`;
  application?: string;
  scope?: string;
  allowances?: { asset: string; amount: string }[];
  expiresInSeconds?: number;
  onAuthRequest?: () => void;
  onAuthChallenge?: () => void;
  onAuthVerify?: () => void;
  onAuthSuccess?: () => void;
  onAuthError?: (error: Error) => void;
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

export type LedgerBalances = {
  unifiedBalance: number;
  channelBalance: number;
  channelId: `0x${string}` | null;
};

export type DepositBalance = {
  custodyBalance: number;
};

let activeSession: SessionState | null = null;
let sessionPromise: Promise<SessionState> | null = null;
let sessionKey: string | null = null;

const DEFAULT_TOKEN = "0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb";
const DEFAULT_CHAIN_ID = 11155111; // Sepolia
const SESSION_STORAGE_PREFIX = "yellow.session-key.v1";

const ALCHEMY_RPC_URL = process.env.ALCHEMY_RPC_URL;
const FALLBACK_RPC_URL = "https://1rpc.io/sepolia"; // Public fallback

const ensureBrowser = () => {
  if (typeof window === "undefined") {
    throw new Error("Yellow client can only run in the browser.");
  }
};

const getSessionStorageKey = (
  clearnodeUrl: string,
  walletAddress: `0x${string}`,
  chainId: number
) =>
  `${SESSION_STORAGE_PREFIX}:${encodeURIComponent(clearnodeUrl)}:${walletAddress}:${chainId}`;

const loadStoredSessionKey = (
  clearnodeUrl: string,
  walletAddress: `0x${string}`,
  chainId: number
): `0x${string}` | null => {
  ensureBrowser();
  const key = getSessionStorageKey(clearnodeUrl, walletAddress, chainId);
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    if (raw.trim().startsWith("{")) {
      const parsed = JSON.parse(raw) as { sessionPrivateKey?: `0x${string}` };
      return parsed.sessionPrivateKey ?? null;
    }
    return raw as `0x${string}`;
  } catch (error) {
    console.warn("[yellowClient] Failed to parse stored session", error);
    return null;
  }
};

const persistSessionKey = (
  clearnodeUrl: string,
  walletAddress: `0x${string}`,
  chainId: number,
  sessionPrivateKey: `0x${string}`
) => {
  ensureBrowser();
  const key = getSessionStorageKey(clearnodeUrl, walletAddress, chainId);
  window.localStorage.setItem(key, sessionPrivateKey);
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
  timeoutMs = 20000,
  debugTag?: string
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
        if (debugTag) {
          log(`${debugTag} received`, method ?? "unknown");
        }
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

const extractResponseMethod = (message: any): string | undefined =>
  message?.method ?? message?.res?.[1];

const extractChannelsFromPayload = (payload: any): any[] => {
  return (
    payload?.channels ??
    payload?.result?.channels ??
    payload?.ledger?.channels ??
    payload?.result?.ledger?.channels ??
    []
  );
};

const fetchConfig = async (
  ws: WebSocket,
  sessionSigner: ReturnType<typeof createECDSAMessageSigner>
) => {
  const { createGetConfigMessage } = await import("@erc7824/nitrolite");
  log("Requesting config...");
  const configMsg = await createGetConfigMessage(sessionSigner);
  ws.send(configMsg);
  const response = await waitForResponse(ws, ["get_config", "config"], 20000, "config");
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

const fromMinorUnits = (value: bigint) => Number(value) / 100;

const pickNumeric = (value: unknown): bigint | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint" || typeof value === "number" || typeof value === "string") {
    return toBigInt(value);
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = pickNumeric(entry);
      if (found !== null) return found;
    }
    return null;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = [
      "available",
      "available_balance",
      "unified",
      "unified_balance",
      "balance",
      "amount",
      "total",
      "free",
    ];
    for (const key of keys) {
      if (record[key] !== undefined) {
        const found = pickNumeric(record[key]);
        if (found !== null) return found;
      }
    }
  }
  return null;
};

const extractUnifiedBalance = (payload: any): bigint => {
  const candidates = [
    payload?.balances,
    payload?.balances?.available,
    payload?.balances?.unified,
    payload?.balances?.balance,
    payload?.result?.balances,
    payload?.result?.balances?.available,
    payload?.result?.balances?.unified,
    payload?.result?.balances?.balance,
    payload?.ledger?.balances,
    payload?.ledger?.available,
    payload?.ledger?.balance,
    payload?.result?.ledger?.balances,
    payload?.result?.ledger?.available,
    payload?.result?.ledger?.balance,
    payload?.available_balance,
    payload?.unified_balance,
    payload?.balance,
    payload?.available,
  ];
  for (const candidate of candidates) {
    const value = pickNumeric(candidate);
    if (value !== null) return value;
  }
  return 0n;
};

const ensureSession = () => {
  if (!activeSession) {
    throw new Error("Yellow session not initialized. Call openChannel first.");
  }
  return activeSession;
};

export function getActiveSession() {
  return activeSession;
}

const reuseSessionIfPossible = (config: YellowConnectionConfig) => {
  if (!activeSession) return null;
  if (activeSession.walletAddress !== config.address) return null;
  if (activeSession.ws.readyState !== WebSocket.OPEN) return null;
  return activeSession;
};

const connectSession = async (config: YellowConnectionConfig): Promise<SessionState> => {
  const existing = reuseSessionIfPossible(config);
  if (existing) return existing;

  const chainId = config.walletClient.chain?.id ?? DEFAULT_CHAIN_ID;
  const nextKey = `${config.clearnodeUrl}:${config.address}:${chainId}`;
  if (sessionPromise && sessionKey === nextKey) {
    return sessionPromise;
  }

  sessionKey = nextKey;

  sessionPromise = (async () => {
    const storedSessionKey = loadStoredSessionKey(
      config.clearnodeUrl,
      config.address,
      chainId
    );
    const createSession = async (
      sessionPrivateKeyOverride?: `0x${string}`
    ): Promise<SessionState> => {
      const nitrolite = await import("@erc7824/nitrolite");
      const {
        createAuthRequestMessage,
        createAuthVerifyMessageFromChallenge,
        createECDSAMessageSigner,
        createEIP712AuthMessageSigner,
      } = nitrolite;
      const viemAccounts = await import("viem/accounts");

      log("Opening channel on chain:", chainId);

      const sessionPrivateKey =
        sessionPrivateKeyOverride ?? viemAccounts.generatePrivateKey();
      const sessionAccount = viemAccounts.privateKeyToAccount(sessionPrivateKey);
      const sessionSigner = createECDSAMessageSigner(sessionPrivateKey);
      log(
        sessionPrivateKeyOverride
          ? "Reusing stored session key:"
          : "Generated session key:",
        sessionAccount.address
      );

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

      const expiresAtSeconds =
        Math.floor(Date.now() / 1000) + (config.expiresInSeconds ?? 3600);
      const authParams = {
        session_key: sessionState.sessionAddress,
        allowances: config.allowances ?? [
          {
            asset: "ytest.usd",
            amount: "1000000000",
          },
        ],
        expires_at: BigInt(expiresAtSeconds),
        scope: config.scope ?? "auction.app",
      };

      const authRequest = await createAuthRequestMessage({
        address: config.address,
        application: config.application ?? "Yellow Auction",
        ...authParams,
      });

      log("Sending auth_request...");
      config.onAuthRequest?.();
      ws.send(authRequest);

      const challenge = await waitForResponse(ws, "auth_challenge", 20000, "auth");
      const challengeMessage = challenge?.res?.[2]?.challenge_message;
      if (!challengeMessage) {
        throw new Error("Missing auth challenge from Yellow.");
      }
      log("Received auth_challenge.");
      config.onAuthChallenge?.();

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
      config.onAuthVerify?.();
      ws.send(verifyMsg);
      await waitForResponse(ws, "auth_verify", 20000, "auth");
      log("Authenticated.");
      config.onAuthSuccess?.();

      persistSessionKey(
        sessionState.clearnodeUrl,
        sessionState.walletAddress,
        sessionState.chainId,
        sessionState.sessionPrivateKey
      );

      activeSession = sessionState;
      return sessionState;
    };

    return await createSession(storedSessionKey ?? undefined);
  })();

  try {
    const result = await sessionPromise;
    return result;
  } catch (error) {
    sessionPromise = null;
    sessionKey = null;
    if (error instanceof Error) {
      config.onAuthError?.(error);
    } else {
      config.onAuthError?.(new Error("Unknown auth error"));
    }
    throw error;
  } finally {
    sessionPromise = null;
  }
};

const detectOpenChannelId = async (sessionState: SessionState): Promise<`0x${string}` | null> => {
  const nitrolite = await import("@erc7824/nitrolite");
  const { NitroliteClient, WalletStateSigner } = nitrolite;
  const viem = await import("viem");
  const viemChains = await import("viem/chains");

  const network = resolveNetwork(sessionState.config, sessionState.chainId);
  const custody = network?.custody_address ?? network?.custodyAddress;
  const adjudicator = network?.adjudicator_address ?? network?.adjudicatorAddress;
  if (!custody || !adjudicator) {
    throw new Error("Missing custody/adjudicator addresses for selected chain.");
  }

  const publicClient = viem.createPublicClient({
    chain: sessionState.walletClient.chain ?? viemChains.sepolia,
    transport: viem.http(ALCHEMY_RPC_URL || FALLBACK_RPC_URL),
  });

  const nitroliteClient = new NitroliteClient({
    publicClient,
    walletClient: sessionState.walletClient,
    stateSigner: new WalletStateSigner(sessionState.walletClient),
    addresses: {
      custody,
      adjudicator,
    },
    chainId: sessionState.chainId,
    challengeDuration: 3600n,
  });

  log("Fetching open channels from L1...");
  const openChannels = await nitroliteClient.getOpenChannels();
  return (openChannels?.[0] as `0x${string}` | undefined) ?? null;
};

export async function getLedgerBalances(): Promise<LedgerBalances> {
  const sessionState = ensureSession();
  const { createGetLedgerBalancesMessage } = await import("@erc7824/nitrolite");
  const ledgerMsg = await createGetLedgerBalancesMessage(
    sessionState.sessionSigner,
    sessionState.walletAddress,
    Date.now()
  );
  log("Requesting ledger balances...");
  sessionState.ws.send(ledgerMsg);
  let ledgerResp = await waitForResponse(
    sessionState.ws,
    ["channels", "get_ledger_balances"],
    20000,
    "ledger"
  );
  let payload = ledgerResp?.res?.[2] ?? ledgerResp?.result ?? ledgerResp?.params ?? {};
  let channels = extractChannelsFromPayload(payload);
  if (extractResponseMethod(ledgerResp) !== "channels" && channels.length === 0) {
    try {
      ledgerResp = await waitForResponse(sessionState.ws, "channels", 8000, "ledger");
      payload = ledgerResp?.res?.[2] ?? ledgerResp?.result ?? ledgerResp?.params ?? {};
      channels = extractChannelsFromPayload(payload);
    } catch (error) {
      log("No channels payload returned after ledger request.", error);
    }
  }
  const targetChannelId = sessionState.channelId;
  const openChannel =
    channels.find((channel: any) => channel.channel_id === targetChannelId) ??
    channels.find((channel: any) => channel.status === "open") ??
    null;
  const channelId =
    (openChannel?.channel_id as `0x${string}` | undefined) ??
    (sessionState.channelId as `0x${string}` | undefined) ??
    null;
  const channelAmount =
    pickNumeric(
      openChannel?.amount ??
        openChannel?.balance ??
        openChannel?.total ??
        openChannel?.balances ??
        openChannel?.allocations
    ) ?? 0n;
  const unified = extractUnifiedBalance(payload);

  log("Ledger balances fetched:", {
    unifiedRaw: unified.toString(),
    channelRaw: channelAmount.toString(),
    channelId,
  });

  if (channelId && sessionState.channelId !== channelId) {
    sessionState.channelId = channelId;
    activeSession = sessionState;
  }

  return {
    unifiedBalance: fromMinorUnits(unified),
    channelBalance: fromMinorUnits(channelAmount),
    channelId,
  };
}

export async function getDepositBalance(): Promise<DepositBalance> {
  ensureBrowser();
  const session = ensureSession();
  const network = resolveNetwork(session.config, session.chainId);
  const custody = network?.custody_address ?? network?.custodyAddress;
  if (!custody) {
    throw new Error("Missing custody address for selected chain.");
  }

  const viem = await import("viem");
  const viemChains = await import("viem/chains");

  const publicClient = viem.createPublicClient({
    chain: session.walletClient.chain ?? viemChains.sepolia,
    transport: viem.http(ALCHEMY_RPC_URL || FALLBACK_RPC_URL),
  });

  const balances = (await publicClient.readContract({
    address: custody,
    abi: [
      {
        type: "function",
        name: "getAccountsBalances",
        inputs: [
          { name: "users", type: "address[]" },
          { name: "tokens", type: "address[]" },
        ],
        outputs: [{ type: "uint256[]" }],
        stateMutability: "view",
      },
    ] as const,
    functionName: "getAccountsBalances",
    args: [[session.walletAddress], [session.token]],
  })) as bigint[];

  log("Deposit balance fetched:", {
    custodyRaw: (balances?.[0] ?? 0n).toString(),
    walletAddress: session.walletAddress,
    token: session.token,
  });

  return {
    custodyBalance: fromMinorUnits(balances?.[0] ?? 0n),
  };
}

export async function detectOpenChannel(
  config: YellowConnectionConfig
): Promise<`0x${string}` | null> {
  ensureBrowser();
  const sessionState = await connectSession(config);
  const channelId = await detectOpenChannelId(sessionState);
  if (channelId) {
    sessionState.channelId = channelId;
    activeSession = sessionState;
    log("Found open channel:", sessionState.channelId);
  } else {
    log("No open channel detected.");
  }
  return channelId;
}

export async function openChannel(config: YellowConnectionConfig): Promise<string> {
  ensureBrowser();

  if (activeSession?.channelId) {
    log("Reusing active channel:", activeSession.channelId);
    return activeSession.channelId;
  }

  const nitrolite = await import("@erc7824/nitrolite");
  const {
    createCreateChannelMessage,
    NitroliteClient,
    WalletStateSigner,
  } = nitrolite;
  const viem = await import("viem");
  const viemChains = await import("viem/chains");

  const sessionState = await connectSession(config);

  const existingChannelId = await detectOpenChannelId(sessionState);
  if (existingChannelId) {
    sessionState.channelId = existingChannelId;
    activeSession = sessionState;
    log("Found open channel:", sessionState.channelId);
    return sessionState.channelId;
  }

  log("No open channel. Creating new channel...");
  const createChannel = await createCreateChannelMessage(sessionState.sessionSigner, {
    chain_id: sessionState.chainId,
    token: sessionState.token,
  });
  console.log("DEBUG: Sending create_channel payload:", JSON.stringify(createChannel));
  sessionState.ws.send(createChannel);
  const created = await waitForResponse(
    sessionState.ws,
    "create_channel",
    20000,
    "create_channel"
  );
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

  const network = resolveNetwork(sessionState.config, sessionState.chainId);
  const custody = network?.custody_address ?? network?.custodyAddress;
  const adjudicator = network?.adjudicator_address ?? network?.adjudicatorAddress;
  if (!custody || !adjudicator) {
    throw new Error("Missing custody/adjudicator addresses for selected chain.");
  }

  const publicClient = viem.createPublicClient({
    chain: sessionState.walletClient.chain ?? viemChains.sepolia,
    transport: viem.http(ALCHEMY_RPC_URL || FALLBACK_RPC_URL),
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
    chainId: sessionState.chainId,
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
  const { createResizeChannelMessage } = await import("@erc7824/nitrolite");

  const rounded = Math.max(0, Math.round(amount * 100));
  if (rounded === 0) return;

  const connectedWallet =
    (session.walletClient.account?.address as `0x${string}` | undefined) ??
    session.walletAddress;

  log("Depositing (allocate_amount):", rounded);
  const resizeMsg = await createResizeChannelMessage(session.sessionSigner, {
    channel_id: session.channelId as `0x${string}`,
    allocate_amount: BigInt(rounded),
    funds_destination: connectedWallet,
  });

  session.ws.send(resizeMsg);
  await waitForResponse(session.ws, "resize_channel", 20000, "resize_channel");
  log("Deposit confirmed.");
}

export async function withdraw(amount: number): Promise<void> {
  void amount;
  console.warn(
    "Withdraw flow requires on-chain close/withdraw. Not implemented in the browser client yet."
  );
}

export async function closeChannel(): Promise<string> {
  ensureBrowser();
  const session = ensureSession();
  if (!session.channelId) {
    throw new Error("No active channel to close.");
  }

  const nitrolite = await import("@erc7824/nitrolite");
  const { createCloseChannelMessage, NitroliteClient, WalletStateSigner } = nitrolite;
  const viem = await import("viem");
  const viemChains = await import("viem/chains");

  log("Sending close_channel request...");
  const closeMsg = await createCloseChannelMessage(
    session.sessionSigner,
    session.channelId as `0x${string}`,
    session.walletAddress
  );
  session.ws.send(closeMsg);
  const closeResponse = await waitForResponse(
    session.ws,
    "close_channel",
    30000,
    "close_channel"
  );
  const payload = closeResponse?.res?.[2];
  if (!payload) {
    throw new Error("Yellow did not return close_channel data.");
  }

  const network = resolveNetwork(session.config, session.chainId);
  const custody = network?.custody_address ?? network?.custodyAddress;
  const adjudicator = network?.adjudicator_address ?? network?.adjudicatorAddress;
  if (!custody || !adjudicator) {
    throw new Error("Missing custody/adjudicator addresses for selected chain.");
  }

  const publicClient = viem.createPublicClient({
    chain: session.walletClient.chain ?? viemChains.sepolia,
    transport: viem.http(ALCHEMY_RPC_URL || FALLBACK_RPC_URL),
  });

  const nitroliteClient = new NitroliteClient({
    publicClient,
    walletClient: session.walletClient,
    stateSigner: new WalletStateSigner(session.walletClient),
    addresses: {
      custody,
      adjudicator,
    },
    chainId: session.chainId,
    challengeDuration: 3600n,
  });

  const state = payload.state ?? {};
  const channelId =
    (payload.channel_id ?? payload.channelId ?? session.channelId) as `0x${string}`;

  const txHash = await nitroliteClient.closeChannel({
    finalState: {
      intent: Number(state.intent ?? 0),
      version: toBigInt(state.version),
      data: state.state_data || state.data || "0x",
      allocations: (state.allocations ?? []).map((allocation: any) => ({
        destination: allocation.destination,
        token: allocation.token,
        amount: toBigInt(allocation.amount),
      })),
      channelId,
      serverSignature:
        (payload.server_signature ?? payload.serverSignature) as `0x${string}`,
    },
    stateData: state.state_data || state.data || "0x",
  });

  log("Channel closed on-chain:", txHash);
  try {
    session.ws.close();
  } catch (error) {
    console.warn("[yellowClient] Failed to close WebSocket", error);
  }
  activeSession = null;
  sessionKey = null;
  sessionPromise = null;
  return typeof txHash === "string" ? txHash : txHash?.toString?.() ?? "";
}
