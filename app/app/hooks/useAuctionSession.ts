"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useYellow } from "./useYellow";

export interface AppAllocation {
  participant: string;
  amount: number;
  assetId: string;
}

export interface AppDefinition {
  appId: string;
  participants: string[];
  allocations: AppAllocation[];
  version: number;
  state: {
    currentPrice: number;
    timeLeft: number;
    lastBidder?: string;
  };
}

export type SessionUpdatePayload = {
  id: string;
  session_id?: string;
  version?: number;
  state?: {
    currentPrice?: number;
    timeLeft?: number;
    lastBidder?: string;
  };
  allocations?: AppAllocation[];
};

const DEFAULT_TIMER = 15;

const formatTime = (seconds: number) => `0:${seconds.toString().padStart(2, "0")}`;

const mockWalletAddress = "0xA11c...9E2b";

export function useAuctionSession(auctionId: string) {
  const { ws, unifiedBalance, deposit, messageSigner, openChannel } = useYellow();
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

  const joinAuction = useCallback(async () => {
    const channelId = await openChannel();
    const nextSessionId = `${auctionId}-${channelId}`;
    setSessionId(nextSessionId);

    if (ws?.readyState === WebSocket.OPEN) {
      const payload = {
        method: "open_session",
        params: {
          auction_id: auctionId,
          channel_id: channelId,
        },
      };
      const signature = await messageSigner(JSON.stringify(payload));
      ws.send(JSON.stringify({ ...payload, signature }));
      // TODO: Sync with experiments/yellow/index.ts open session message format
    }
  }, [auctionId, openChannel, ws, messageSigner]);

  useEffect(() => {
    if (!sessionId && ws?.readyState === WebSocket.OPEN) {
      joinAuction();
    }
  }, [joinAuction, sessionId, ws?.readyState]);

  const placeBid = useCallback(async () => {
    const bidAmount = 0.01;
    const depositAmount = unifiedBalance < bidAmount ? 1 : 0;
    if (depositAmount > 0) {
      await deposit(depositAmount);
    }

    if (!sessionId) return;

    const nextVersion = version + 1;
    const nextPrice = Number((currentPrice + bidAmount).toFixed(2));
    const nextUserBalance = Number(
      Math.max(0, unifiedBalance + depositAmount - bidAmount).toFixed(2)
    );
    const intent = {
      type: "OPERATE",
      from: mockWalletAddress,
      to: "auction_pool",
      amount: bidAmount,
    };

    const appDefinition: AppDefinition = {
      appId: auctionId,
      participants: [mockWalletAddress, "clearnode"],
      allocations: [
        { participant: mockWalletAddress, amount: nextUserBalance, assetId: "ytest.usd" },
        { participant: "auction_pool", amount: nextPrice, assetId: "ytest.usd" },
      ],
      version: nextVersion,
      state: {
        currentPrice: nextPrice,
        timeLeft: DEFAULT_TIMER,
        lastBidder: mockWalletAddress,
      },
    };

    const payload = {
      method: "submit_app_state",
      params: {
        session_id: sessionId,
        version: nextVersion,
        intent,
        app_definition: appDefinition,
      },
    };

    const signature = await messageSigner(JSON.stringify(payload));

    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ ...payload, signature }));
      // TODO: Sync with experiments/yellow/index.ts submit_app_state call
    }

    setVersion(nextVersion);
    setCurrentPrice(nextPrice);
    setTimeLeft(DEFAULT_TIMER);
    setLastBidder(mockWalletAddress);
    setHistory((prev) => [
      { id: `${Date.now()}-${Math.random()}`, version: nextVersion, state: appDefinition.state },
      ...prev,
    ].slice(0, 8));
  }, [
    auctionId,
    currentPrice,
    deposit,
    messageSigner,
    sessionId,
    unifiedBalance,
    version,
    ws,
  ]);

  const handleSessionUpdate = useCallback((payload: SessionUpdatePayload) => {
    if (!payload) return;
    if (payload.version && payload.version <= version) return;

    const nextPrice = payload.state?.currentPrice ?? currentPrice;
    const nextBidder = payload.state?.lastBidder ?? lastBidder;
    const nextVersion = payload.version ?? version;

    setCurrentPrice(nextPrice);
    setLastBidder(nextBidder);
    setVersion(nextVersion);
    setTimeLeft(DEFAULT_TIMER);
    setHistory((prev) => [payload, ...prev].slice(0, 8));
  }, [currentPrice, lastBidder, version]);

  useEffect(() => {
    if (!ws) return;

    const handler = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data as string);
        const method = message?.method ?? message?.res?.[1];
        if (method !== "session_update") return;
        const payload = message?.params ?? message?.res?.[2];
        handleSessionUpdate({
          id: `${Date.now()}-${Math.random()}`,
          ...(payload as Omit<SessionUpdatePayload, "id">),
        });
      } catch (error) {
        console.warn("Failed to parse session update", error);
      }
    };

    ws.addEventListener("message", handler);
    return () => ws.removeEventListener("message", handler);
  }, [ws, handleSessionUpdate]);

  const formattedTime = useMemo(() => formatTime(timeLeft), [timeLeft]);

  return {
    sessionId,
    version,
    currentPrice,
    timeLeft,
    formattedTime,
    lastBidder,
    history,
    joinAuction,
    placeBid,
  };
}
