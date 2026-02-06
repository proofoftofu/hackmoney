"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RPCAppStateIntent,
  RPCMethod,
  type RPCAppSessionAllocation,
  type RPCResponse,
} from "@erc7824/nitrolite";
import { useYellow } from "./useYellow";

export type SessionUpdatePayload = {
  id: string;
  sessionId: string;
  version: number;
  state: AuctionSessionState;
};

type AuctionSessionState = {
  currentPrice: number;
  timeLeft: number;
  lastBidder?: string;
};

type SessionData = {
  auctionId: string;
  state: AuctionSessionState;
};

const DEFAULT_TIMER = 15;

const formatTime = (seconds: number) =>
  `0:${seconds.toString().padStart(2, "0")}`;

const parseSessionData = (raw?: string | null): SessionData | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
};

export function useAuctionSession(
  auctionId: string,
  sellerAddress: `0x${string}`
) {
  const {
    createAppSession,
    submitAppState,
    subscribe,
    walletAddress,
    isConnected,
    hasWallet,
  } = useYellow();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [currentPrice, setCurrentPrice] = useState(0.05);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIMER);
  const [lastBidder, setLastBidder] = useState<string | undefined>(undefined);
  const [history, setHistory] = useState<SessionUpdatePayload[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) return;

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const createSession = useCallback(async () => {
    if (!walletAddress) {
      throw new Error("Connect a wallet before starting the auction session.");
    }

    const allocations: RPCAppSessionAllocation[] = [
      { participant: sellerAddress, asset: "ytest.usd", amount: "0.00" },
      { participant: walletAddress, asset: "ytest.usd", amount: "0.00" },
    ];

    const response = await createAppSession({
      participants: [sellerAddress, walletAddress],
      allocations,
      application: `Auction:${auctionId}`,
    });

    setSessionId(response.appSessionId);
    setVersion(response.version ?? 0);

    const seedState: AuctionSessionState = {
      currentPrice,
      timeLeft: DEFAULT_TIMER,
      lastBidder,
    };

    setHistory((prev) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        sessionId: response.appSessionId,
        version: response.version ?? 0,
        state: seedState,
      },
      ...prev,
    ].slice(0, 8));
  }, [walletAddress, sellerAddress, auctionId, createAppSession, currentPrice, lastBidder]);

  useEffect(() => {
    if (!hasWallet || !isConnected || sessionId) return;
    createSession().catch((error) => {
      console.warn("Failed to create auction session", error);
    });
  }, [createSession, hasWallet, isConnected, sessionId]);

  const placeBid = useCallback(async () => {
    if (!sessionId || !walletAddress) return;

    const bidAmount = 0.01;
    const nextVersion = version + 1;
    const nextPrice = Number((currentPrice + bidAmount).toFixed(2));

    const nextState: AuctionSessionState = {
      currentPrice: nextPrice,
      timeLeft: DEFAULT_TIMER,
      lastBidder: walletAddress,
    };

    const sessionData: SessionData = {
      auctionId,
      state: nextState,
    };

    const allocations: RPCAppSessionAllocation[] = [
      { participant: sellerAddress, asset: "ytest.usd", amount: nextPrice.toFixed(2) },
      { participant: walletAddress, asset: "ytest.usd", amount: "0.00" },
    ];

    await submitAppState({
      appSessionId: sessionId as `0x${string}`,
      allocations,
      version: nextVersion,
      intent: RPCAppStateIntent.Operate,
      sessionData: JSON.stringify(sessionData),
    });

    setVersion(nextVersion);
    setCurrentPrice(nextPrice);
    setTimeLeft(DEFAULT_TIMER);
    setLastBidder(walletAddress);
    setHistory((prev) => [
      { id: `${Date.now()}-${Math.random()}`, sessionId, version: nextVersion, state: nextState },
      ...prev,
    ].slice(0, 8));
  }, [sessionId, walletAddress, version, currentPrice, auctionId, sellerAddress, submitAppState]);

  const handleSessionUpdate = useCallback(
    (payload: SessionUpdatePayload) => {
      if (!payload) return;
      if (payload.sessionId !== sessionId) return;
      if (payload.version <= version) return;

      const nextState = payload.state;

      setCurrentPrice(nextState.currentPrice);
      setLastBidder(nextState.lastBidder);
      setVersion(payload.version);
      setTimeLeft(DEFAULT_TIMER);
      setHistory((prev) => [payload, ...prev].slice(0, 8));
    },
    [sessionId, version]
  );

  useEffect(() => {
    const unsubscribe = subscribe((message: RPCResponse) => {
      const method =
        (message as any)?.method ?? (message as any)?.res?.[1];
      if (method !== RPCMethod.AppSessionUpdate && method !== "asu") return;

      const payload =
        (message as any)?.params ?? (message as any)?.res?.[2] ?? {};
      const appSession = payload?.app_session ?? payload?.appSession ?? payload;
      const appSessionId =
        appSession?.app_session_id ?? appSession?.appSessionId;
      const sessionData =
        appSession?.session_data ?? appSession?.sessionData ?? payload?.session_data;
      const parsed = parseSessionData(sessionData);

      if (!appSessionId || !parsed) return;
      if (parsed.auctionId !== auctionId) return;

      handleSessionUpdate({
        id: `${Date.now()}-${Math.random()}`,
        sessionId: appSessionId,
        version: appSession?.version ?? payload?.version ?? 0,
        state: parsed.state,
      });
    });

    return () => unsubscribe();
  }, [subscribe, auctionId, handleSessionUpdate]);

  const formattedTime = useMemo(() => formatTime(timeLeft), [timeLeft]);

  return {
    sessionId,
    version,
    currentPrice,
    timeLeft,
    formattedTime,
    lastBidder,
    history,
    createSession,
    placeBid,
  };
}
