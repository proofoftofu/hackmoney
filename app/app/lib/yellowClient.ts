import { Client } from "yellow-ts";
import {
  createAppSessionMessage,
  createAuthRequestMessage,
  createAuthVerifyMessage,
  createCloseAppSessionMessage,
  createECDSAMessageSigner,
  createEIP712AuthMessageSigner,
  createSubmitAppStateMessage,
  RPCAppStateIntent,
  RPCMethod,
  RPCProtocolVersion,
  type AuthChallengeResponse,
  type RPCAppDefinition,
  type RPCAppSessionAllocation,
  type RPCResponse,
} from "@erc7824/nitrolite";
import type { WalletClient } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

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

type SessionState = {
  client: Client;
  clearnodeUrl: string;
  walletClient: WalletClient;
  walletAddress: `0x${string}`;
  sessionPrivateKey: `0x${string}`;
  sessionSigner: ReturnType<typeof createECDSAMessageSigner>;
  sessionAddress: `0x${string}`;
};

export type CreateAppSessionInput = {
  participants: `0x${string}`[];
  allocations: RPCAppSessionAllocation[];
  application?: string;
  protocol?: RPCProtocolVersion;
  weights?: number[];
  quorum?: number;
  challenge?: number;
  nonce?: number;
};

export type CreateAppSessionResult = {
  appSessionId: `0x${string}`;
  version?: number;
  status?: string;
  response: RPCResponse;
};

export type SubmitAppStateInput = {
  appSessionId: `0x${string}`;
  allocations: RPCAppSessionAllocation[];
  version: number;
  intent?: RPCAppStateIntent;
  sessionData?: string;
};

export type CloseAppSessionInput = {
  appSessionId: `0x${string}`;
  allocations: RPCAppSessionAllocation[];
};

let activeSession: SessionState | null = null;
let sessionPromise: Promise<SessionState> | null = null;
let sessionKey: string | null = null;
const SESSION_STORAGE_PREFIX = "yellow.session-key.v2";

const listeners = new Set<(message: RPCResponse) => void>();
let clientUnsubscribe: (() => void) | null = null;

const ensureBrowser = () => {
  if (typeof window === "undefined") {
    throw new Error("Yellow client can only run in the browser.");
  }
};

const getSessionStorageKey = (
  clearnodeUrl: string,
  walletAddress: `0x${string}`
) => `${SESSION_STORAGE_PREFIX}:${encodeURIComponent(clearnodeUrl)}:${walletAddress}`;

const loadStoredSessionKey = (
  clearnodeUrl: string,
  walletAddress: `0x${string}`
): `0x${string}` | null => {
  ensureBrowser();
  const key = getSessionStorageKey(clearnodeUrl, walletAddress);
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    if (raw.trim().startsWith("{")) {
      const parsed = JSON.parse(raw) as { sessionPrivateKey?: `0x${string}` };
      return parsed.sessionPrivateKey ?? null;
    }
    return raw as `0x${string}`;
  } catch {
    return null;
  }
};

const persistSessionKey = (
  clearnodeUrl: string,
  walletAddress: `0x${string}`,
  sessionPrivateKey: `0x${string}`
) => {
  ensureBrowser();
  const key = getSessionStorageKey(clearnodeUrl, walletAddress);
  window.localStorage.setItem(key, sessionPrivateKey);
};

const clearStoredSessionKey = (
  clearnodeUrl: string,
  walletAddress: `0x${string}`
) => {
  ensureBrowser();
  const key = getSessionStorageKey(clearnodeUrl, walletAddress);
  window.localStorage.removeItem(key);
};

const extractMethod = (message: RPCResponse) =>
  (message as any)?.method ?? (message as any)?.res?.[1];

const waitForMethod = (
  method: RPCMethod | string,
  timeoutMs = 20000
) =>
  new Promise<RPCResponse>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for ${String(method)}.`));
    }, timeoutMs);

    const handler = (message: RPCResponse) => {
      if (extractMethod(message) !== method) return;
      cleanup();
      resolve(message);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      listeners.delete(handler);
    };

    listeners.add(handler);
  });

const attachClientListener = (client: Client) => {
  if (clientUnsubscribe) return;
  clientUnsubscribe = client.listen((message: RPCResponse) => {
    for (const listener of listeners) {
      listener(message);
    }
  });
};

const authenticateWallet = async (
  sessionState: SessionState,
  config: YellowConnectionConfig
) => {
  const expiresAtSeconds =
    Math.floor(Date.now() / 1000) + (config.expiresInSeconds ?? 3600);
  const authParams = {
    address: config.address,
    session_key: sessionState.sessionAddress,
    application: config.application ?? "Yellow Auction",
    allowances: config.allowances ?? [
      {
        asset: "ytest.usd",
        amount: "1000000000",
      },
    ],
    expires_at: BigInt(expiresAtSeconds),
    scope: config.scope ?? "auction.app",
  };

  const authRequest = await createAuthRequestMessage(authParams);

  const handleChallenge = async (message: AuthChallengeResponse) => {
    config.onAuthChallenge?.();

    const authSigner = createEIP712AuthMessageSigner(
      sessionState.walletClient,
      authParams,
      { name: config.application ?? "Yellow Auction" }
    );

    const authVerifyMessage = await createAuthVerifyMessage(authSigner, message);
    config.onAuthVerify?.();
    await sessionState.client.sendMessage(authVerifyMessage);
  };

  const challengeHandler = (message: RPCResponse) => {
    if (extractMethod(message) !== RPCMethod.AuthChallenge) return;
    handleChallenge(message as AuthChallengeResponse).catch((error) => {
      console.warn("[yellowClient] Auth challenge handler failed", error);
    });
  };

  listeners.add(challengeHandler);

  config.onAuthRequest?.();
  await sessionState.client.sendMessage(authRequest);

  try {
    await waitForMethod(RPCMethod.AuthVerify);
    config.onAuthSuccess?.();
  } finally {
    listeners.delete(challengeHandler);
  }
};

const reuseSessionIfPossible = (config: YellowConnectionConfig) => {
  if (!activeSession) return null;
  if (activeSession.walletAddress !== config.address) return null;
  if (activeSession.clearnodeUrl !== config.clearnodeUrl) return null;
  return activeSession;
};

const connectSession = async (
  config: YellowConnectionConfig
): Promise<SessionState> => {
  ensureBrowser();
  const existing = reuseSessionIfPossible(config);
  if (existing) return existing;

  const nextKey = `${config.clearnodeUrl}:${config.address}`;
  if (sessionPromise && sessionKey === nextKey) {
    return sessionPromise;
  }

  sessionKey = nextKey;

  sessionPromise = (async () => {
    const storedSessionKey = loadStoredSessionKey(
      config.clearnodeUrl,
      config.address
    );

    const sessionPrivateKey = storedSessionKey ?? generatePrivateKey();
    const sessionAccount = privateKeyToAccount(sessionPrivateKey);
    const sessionSigner = createECDSAMessageSigner(sessionPrivateKey);

    const client = new Client({ url: config.clearnodeUrl });
    await client.connect();
    attachClientListener(client);

    const sessionState: SessionState = {
      client,
      clearnodeUrl: config.clearnodeUrl,
      walletClient: config.walletClient,
      walletAddress: config.address,
      sessionPrivateKey,
      sessionSigner,
      sessionAddress: sessionAccount.address,
    };

    await authenticateWallet(sessionState, config);

    persistSessionKey(
      sessionState.clearnodeUrl,
      sessionState.walletAddress,
      sessionState.sessionPrivateKey
    );

    activeSession = sessionState;
    return sessionState;
  })();

  try {
    return await sessionPromise;
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

const ensureSession = () => {
  if (!activeSession) {
    throw new Error("Yellow session not initialized.");
  }
  return activeSession;
};

export function getActiveSession() {
  return activeSession;
}

export async function connectYellowSession(config: YellowConnectionConfig) {
  return connectSession(config);
}

export async function disconnectYellowSession() {
  if (!activeSession) return;
  try {
    await activeSession.client.disconnect();
  } finally {
    if (clientUnsubscribe) {
      clientUnsubscribe();
      clientUnsubscribe = null;
    }
    clearStoredSessionKey(activeSession.clearnodeUrl, activeSession.walletAddress);
    listeners.clear();
    activeSession = null;
    sessionKey = null;
    sessionPromise = null;
  }
}

export function subscribeToMessages(handler: (message: RPCResponse) => void) {
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
}

export async function createAppSession(
  input: CreateAppSessionInput
): Promise<CreateAppSessionResult> {
  const session = ensureSession();
  const defaultWeight = Math.floor(100 / input.participants.length);
  const definition: RPCAppDefinition = {
    protocol: input.protocol ?? RPCProtocolVersion.NitroRPC_0_4,
    participants: input.participants,
    weights: input.weights ?? input.participants.map(() => defaultWeight),
    quorum: input.quorum ?? 100,
    challenge: input.challenge ?? 0,
    nonce: input.nonce ?? Date.now(),
    application: input.application ?? "Yellow Auction",
  };

  const message = await createAppSessionMessage(session.sessionSigner, {
    definition,
    allocations: input.allocations,
  });

  const response = (await session.client.sendMessage(
    message
  )) as RPCResponse;

  const params = (response as any)?.params ?? (response as any)?.res?.[2] ?? {};
  const appSessionId =
    (params?.app_session_id ?? params?.appSessionId) as `0x${string}`;

  if (!appSessionId) {
    throw new Error("Yellow did not return app_session_id.");
  }

  return {
    appSessionId,
    version: params?.version,
    status: params?.status,
    response,
  };
}

export async function submitAppState(input: SubmitAppStateInput) {
  const session = ensureSession();
  const params = {
    app_session_id: input.appSessionId,
    allocations: input.allocations,
    version: input.version,
    intent: input.intent ?? RPCAppStateIntent.Operate,
    ...(input.sessionData ? { session_data: input.sessionData } : {}),
  };

  const message = await createSubmitAppStateMessage(
    session.sessionSigner,
    params
  );

  return session.client.sendMessage(message);
}

export async function closeAppSession(input: CloseAppSessionInput) {
  const session = ensureSession();
  const message = await createCloseAppSessionMessage(session.sessionSigner, {
    app_session_id: input.appSessionId,
    allocations: input.allocations,
  });
  return session.client.sendMessage(message);
}
