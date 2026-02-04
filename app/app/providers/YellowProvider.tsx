"use client";

import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import {
  deposit as sdkDeposit,
  openChannel as sdkOpenChannel,
  withdraw as sdkWithdraw,
} from "../lib/yellowClient";

type YellowContextValue = {
  ws: WebSocket | null;
  isConnected: boolean;
  unifiedBalance: number;
  setUnifiedBalance: (next: number) => void;
  messageSigner: (payload: string) => Promise<string>;
  openChannel: () => Promise<string>;
  deposit: (amount: number) => Promise<void>;
  withdraw: (amount: number) => Promise<void>;
};

export const YellowContext = createContext<YellowContextValue | null>(null);

const CLEARNODE_URL = "wss://clearnet-sandbox.yellow.com/ws";

type YellowProviderProps = {
  children: React.ReactNode;
};

export function YellowProvider({ children }: YellowProviderProps) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [unifiedBalance, setUnifiedBalance] = useState(18.4);

  useEffect(() => {
    const socket = new WebSocket(CLEARNODE_URL);

    socket.addEventListener("open", () => setIsConnected(true));
    socket.addEventListener("close", () => setIsConnected(false));
    socket.addEventListener("error", () => setIsConnected(false));

    setWs(socket);

    return () => {
      socket.close();
    };
  }, []);

  const messageSigner = useCallback(async (payload: string) => {
    // TODO: Sync with messageSigner pattern from experiments/yellow/index.ts
    // Replace with wallet-based signer (EIP-712 / personal_sign).
    await new Promise((resolve) => setTimeout(resolve, 120));
    return `mock_signature_${btoa(payload).slice(0, 16)}`;
  }, []);

  const openChannel = useCallback(async () => {
    return sdkOpenChannel({ clearnodeUrl: CLEARNODE_URL });
  }, []);

  const deposit = useCallback(async (amount: number) => {
    await sdkDeposit(amount);
    setUnifiedBalance((prev) => Number((prev + amount).toFixed(2)));
  }, []);

  const withdraw = useCallback(async (amount: number) => {
    await sdkWithdraw(amount);
    setUnifiedBalance((prev) => Math.max(0, Number((prev - amount).toFixed(2))));
  }, []);

  const value = useMemo<YellowContextValue>(
    () => ({
      ws,
      isConnected,
      unifiedBalance,
      setUnifiedBalance,
      messageSigner,
      openChannel,
      deposit,
      withdraw,
    }),
    [
      ws,
      isConnected,
      unifiedBalance,
      messageSigner,
      openChannel,
      deposit,
      withdraw,
    ]
  );

  return (
    <YellowContext.Provider value={value}>{children}</YellowContext.Provider>
  );
}
