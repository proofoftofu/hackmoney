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
  bidCount: number;
  totalFees: number;
};

type SessionData = {
  auctionId: string;
  state: AuctionSessionState;
};

const DEFAULT_TIMER = 15;
const DEFAULT_BUDGET = 100;
const BID_FEE = 1.0;
const BID_INCREMENT = 0.01;
const SESSION_WEIGHTS = [40, 40, 50] as const;
const SESSION_QUORUM = 80;

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
  const [totalFees, setTotalFees] = useState(0);
  const [history, setHistory] = useState<SessionUpdatePayload[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const versionRef = useRef(0);
  const baseVersionRef = useRef(0);
  const operatorAddress = process.env.NEXT_PUBLIC_OPERATOR_ADDRESS as
    | `0x${string}`
    | undefined;

  useEffect(() => {
    versionRef.current = version;
  }, [version]);

  useEffect(() => {
    if (!sessionId) {
      setTotalFees(0);
      return;
    }
    const bidsCount = Math.max(0, version - baseVersionRef.current);
    setTotalFees(Number((bidsCount * BID_FEE).toFixed(2)));
  }, [sessionId, version]);

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
    if (!operatorAddress) {
      throw new Error("Operator address is missing.");
    }

    const nextBudget =
      typeof inputBudget === "number" && Number.isFinite(inputBudget)
        ? inputBudget
        : budget;
    if (nextBudget <= currentPrice + BID_FEE) {
      throw new Error("Budget must be greater than the starting price plus fee.");
    }
    setBudget(nextBudget);

    const allocations: RPCAppSessionAllocation[] = [
      { participant: sellerAddress, asset: "ytest.usd", amount: "0.00" },
      {
        participant: walletAddress,
        asset: "ytest.usd",
        amount: nextBudget.toFixed(2),
      },
      { participant: operatorAddress, asset: "ytest.usd", amount: "0.00" },
    ];

    const response = await createAppSession({
      participants: [sellerAddress, walletAddress, operatorAddress],
      allocations,
      weights: [...SESSION_WEIGHTS],
      quorum: SESSION_QUORUM,
      application: `YellowAuction`,
    });

    const baseVersion = response.version ?? 0;
    baseVersionRef.current = baseVersion;
    setSessionId(response.appSessionId);
    setVersion(baseVersion);
    setTimeLeft(DEFAULT_TIMER);

    const initialPrice = 0.05;
    const nextVersion = baseVersion + 1;
    const seedState: AuctionSessionState = {
      currentPrice: initialPrice,
      timeLeft: DEFAULT_TIMER,
      lastBidder: walletAddress,
      bidCount: 1,
      totalFees: BID_FEE,
    };

    const seedSessionData: SessionData = {
      auctionId,
      state: seedState,
    };

    const seedTotal = BID_FEE;
    const seedAllocations: RPCAppSessionAllocation[] = [
      { participant: sellerAddress, asset: "ytest.usd", amount: seedTotal.toFixed(2) },
      {
        participant: walletAddress,
        asset: "ytest.usd",
        amount: Math.max(0, nextBudget - seedTotal).toFixed(2),
      },
      { participant: operatorAddress, asset: "ytest.usd", amount: "0.00" },
    ];

    await submitAppState({
      appSessionId: response.appSessionId as `0x${string}`,
      allocations: seedAllocations,
      version: nextVersion,
      intent: RPCAppStateIntent.Operate,
      sessionData: JSON.stringify(seedSessionData),
      requireOperatorSignature: true,
    });

    setVersion(nextVersion);
    versionRef.current = nextVersion;
    setCurrentPrice(initialPrice);
    setLastBidder(walletAddress);

    const seedVersion = response.version ?? 0;
    const historyVersion = nextVersion;
    setHistory((prev) => {
      if (prev.some((entry) => entry.sessionId === response.appSessionId && entry.version === historyVersion)) {
        return prev;
      }
      return [
        {
          id: `${Date.now()}-${Math.random()}`,
          sessionId: response.appSessionId,
          version: historyVersion,
          state: seedState,
        },
        ...prev,
      ].slice(0, 8);
    });
  }, [
    walletAddress,
    sellerAddress,
    auctionId,
    createAppSession,
    currentPrice,
    lastBidder,
    budget,
    submitAppState,
    operatorAddress,
  ]);

  useEffect(() => {
    if (hasWallet && !isConnected) {
      setSessionId(null);
      setVersion(0);
      setTimeLeft(0);
      setCurrentPrice(0.05);
      setLastBidder(undefined);
      setBudget(DEFAULT_BUDGET);
      setTotalFees(0);
      baseVersionRef.current = 0;
      setHistory([]);
    }
  }, [hasWallet, isConnected]);

  const placeBid = useCallback(async () => {
    if (!sessionId || !walletAddress || !operatorAddress) return;
    console.log("[yellow] placeBid", { auctionId, sessionId, walletAddress });

    const bidAmount = BID_INCREMENT;
    const nextVersion = version + 1;
    const nextPrice = Number((currentPrice + bidAmount).toFixed(2));

    const nextBidCount = Math.max(1, version + 1 - baseVersionRef.current);
    const nextTotalFees = Number((nextBidCount * BID_FEE).toFixed(2));
    const sellerAmount = Number(nextTotalFees.toFixed(2));
    if (sellerAmount > budget) return;

    const nextState: AuctionSessionState = {
      currentPrice: nextPrice,
      timeLeft: DEFAULT_TIMER,
      lastBidder: walletAddress,
      bidCount: nextBidCount,
      totalFees: nextTotalFees,
    };

    const sessionData: SessionData = {
      auctionId,
      state: nextState,
    };

    const allocations: RPCAppSessionAllocation[] = [
      { participant: sellerAddress, asset: "ytest.usd", amount: sellerAmount.toFixed(2) },
      {
        participant: walletAddress,
        asset: "ytest.usd",
        amount: Math.max(0, budget - sellerAmount).toFixed(2),
      },
      { participant: operatorAddress, asset: "ytest.usd", amount: "0.00" },
    ];

    await submitAppState({
      appSessionId: sessionId as `0x${string}`,
      allocations,
      version: nextVersion,
      intent: RPCAppStateIntent.Operate,
      sessionData: JSON.stringify(sessionData),
      requireOperatorSignature: true,
    });
    console.log("[yellow] bid submitted", {
      auctionId,
      sessionId,
      version: nextVersion,
      price: nextPrice,
    });

    setVersion(nextVersion);
    versionRef.current = nextVersion;
    setCurrentPrice(nextPrice);
    setTimeLeft(DEFAULT_TIMER);
    setLastBidder(walletAddress);
    setTotalFees(nextTotalFees);
    versionRef.current = nextVersion;
    setHistory((prev) => {
      if (prev.some((entry) => entry.sessionId === sessionId && entry.version === nextVersion)) {
        return prev;
      }
      return [
        { id: `${Date.now()}-${Math.random()}`, sessionId, version: nextVersion, state: nextState },
        ...prev,
      ].slice(0, 8);
    });
  }, [
    sessionId,
    walletAddress,
    version,
    currentPrice,
    auctionId,
    sellerAddress,
    submitAppState,
    budget,
    operatorAddress,
  ]);

  const handleSessionUpdate = useCallback(
    (payload: SessionUpdatePayload) => {
      if (!payload) return;
      if (payload.sessionId !== sessionId) return;
      if (payload.version <= versionRef.current) return;
      console.log("[yellow] session update", payload);

      const nextState = payload.state;

      const nextFees =
        typeof nextState.totalFees === "number"
          ? nextState.totalFees
          : Number(
              (Math.max(0, payload.version - baseVersionRef.current) * BID_FEE).toFixed(2)
            );
      const nextPrice =
        typeof nextState.currentPrice === "number"
          ? nextState.currentPrice
          : Number(
              (Math.max(0, payload.version - baseVersionRef.current) * BID_INCREMENT + 0.05).toFixed(2)
            );

      setCurrentPrice(nextPrice);
      setLastBidder(nextState.lastBidder);
      setTotalFees(nextFees);
      setVersion(payload.version);
      versionRef.current = payload.version;
      setTimeLeft(DEFAULT_TIMER);
      setHistory((prev) => {
        if (prev.some((entry) => entry.sessionId === payload.sessionId && entry.version === payload.version)) {
          return prev;
        }
        return [payload, ...prev].slice(0, 8);
      });
    },
    [sessionId]
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
    if (!sessionId || !walletAddress || !operatorAddress) return null;
    const mockSignature = `0xmock-${Date.now().toString(16)}`;
    console.log("[yellow] closeOrder", { auctionId, sessionId, mockSignature });

    const sellerAmount = Number((totalFees + currentPrice).toFixed(2));
    const allocations: RPCAppSessionAllocation[] = [
      { participant: sellerAddress, asset: "ytest.usd", amount: sellerAmount.toFixed(2) },
      {
        participant: walletAddress,
        asset: "ytest.usd",
        amount: Math.max(0, budget - sellerAmount).toFixed(2),
      },
      { participant: operatorAddress, asset: "ytest.usd", amount: "0.00" },
    ];

    await closeAppSession({
      appSessionId: sessionId as `0x${string}`,
      allocations,
      requireOperatorSignature: true,
    });

    return mockSignature;
  }, [
    auctionId,
    sessionId,
    walletAddress,
    sellerAddress,
    currentPrice,
    totalFees,
    budget,
    closeAppSession,
    operatorAddress,
  ]);

  return {
    sessionId,
    version,
    currentPrice,
    timeLeft,
    formattedTime,
    lastBidder,
    budget,
    totalFees,
    history,
    createSession,
    placeBid,
    closeOrder,
  };
}
