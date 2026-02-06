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
const DEFAULT_BUDGET = 100;

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
    closeAppSession,
    submitAppState,
    subscribe,
    walletAddress,
    isConnected,
    hasWallet,
  } = useYellow();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [currentPrice, setCurrentPrice] = useState(0.05);
  const [timeLeft, setTimeLeft] = useState(0);
  const [lastBidder, setLastBidder] = useState<string | undefined>(undefined);
  const [budget, setBudget] = useState(DEFAULT_BUDGET);
  const [history, setHistory] = useState<SessionUpdatePayload[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!sessionId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

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
  }, [sessionId]);

  const createSession = useCallback(async (inputBudget?: number) => {
    if (!walletAddress) {
      throw new Error("Connect a wallet before starting the auction session.");
    }

    const nextBudget =
      typeof inputBudget === "number" && Number.isFinite(inputBudget)
        ? inputBudget
        : budget;
    if (nextBudget <= 0) {
      throw new Error("Budget must be greater than zero.");
    }
    setBudget(nextBudget);

    const allocations: RPCAppSessionAllocation[] = [
      { participant: sellerAddress, asset: "ytest.usd", amount: "0.00" },
      { participant: walletAddress, asset: "ytest.usd", amount: nextBudget.toFixed(2) },
    ];

    const response = await createAppSession({
      participants: [sellerAddress, walletAddress],
      allocations,
      application: `YellowAuction`,
    });

    setSessionId(response.appSessionId);
    setVersion(response.version ?? 0);
    setTimeLeft(DEFAULT_TIMER);

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
  }, [walletAddress, sellerAddress, auctionId, createAppSession, currentPrice, lastBidder, budget]);

  useEffect(() => {
    if (hasWallet && !isConnected) {
      setSessionId(null);
      setVersion(0);
      setTimeLeft(0);
      setCurrentPrice(0.05);
      setLastBidder(undefined);
      setBudget(DEFAULT_BUDGET);
      setHistory([]);
    }
  }, [hasWallet, isConnected]);

  const placeBid = useCallback(async () => {
    if (!sessionId || !walletAddress) return;
    console.log("[yellow] placeBid", { auctionId, sessionId, walletAddress });

    const bidAmount = 0.01;
    const nextVersion = version + 1;
    const nextPrice = Number((currentPrice + bidAmount).toFixed(2));

    if (nextPrice > budget) return;

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
      {
        participant: walletAddress,
        asset: "ytest.usd",
        amount: Math.max(0, budget - nextPrice).toFixed(2),
      },
    ];

    await submitAppState({
      appSessionId: sessionId as `0x${string}`,
      allocations,
      version: nextVersion,
      intent: RPCAppStateIntent.Operate,
      sessionData: JSON.stringify(sessionData),
    });
    console.log("[yellow] bid submitted", {
      auctionId,
      sessionId,
      version: nextVersion,
      price: nextPrice,
    });

    setVersion(nextVersion);
    setCurrentPrice(nextPrice);
    setTimeLeft(DEFAULT_TIMER);
    setLastBidder(walletAddress);
    setHistory((prev) => [
      { id: `${Date.now()}-${Math.random()}`, sessionId, version: nextVersion, state: nextState },
      ...prev,
    ].slice(0, 8));
  }, [sessionId, walletAddress, version, currentPrice, auctionId, sellerAddress, submitAppState, budget]);

  const handleSessionUpdate = useCallback(
    (payload: SessionUpdatePayload) => {
      if (!payload) return;
      if (payload.sessionId !== sessionId) return;
      if (payload.version <= version) return;
      console.log("[yellow] session update", payload);

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

  const closeOrder = useCallback(async () => {
    if (!sessionId || !walletAddress) return null;
    const mockSignature = `0xmock-${Date.now().toString(16)}`;
    console.log("[yellow] closeOrder", { auctionId, sessionId, mockSignature });

    const allocations: RPCAppSessionAllocation[] = [
      { participant: sellerAddress, asset: "ytest.usd", amount: currentPrice.toFixed(2) },
      { participant: walletAddress, asset: "ytest.usd", amount: "0.00" },
    ];

    await closeAppSession({
      appSessionId: sessionId as `0x${string}`,
      allocations,
    });

    return mockSignature;
  }, [auctionId, sessionId, walletAddress, sellerAddress, currentPrice, closeAppSession]);

  return {
    sessionId,
    version,
    currentPrice,
    timeLeft,
    formattedTime,
    lastBidder,
    budget,
    history,
    createSession,
    placeBid,
    closeOrder,
  };
}
