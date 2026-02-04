"use client";

import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import {
  deposit as sdkDeposit,
  openChannel as sdkOpenChannel,
  signSessionMessage,
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
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  useEffect(() => {
    const socket = new WebSocket(CLEARNODE_URL);

    console.log("[YellowProvider] Connecting WebSocket", CLEARNODE_URL);
    socket.addEventListener("open", () => {
      console.log("[YellowProvider] WebSocket connected");
      setIsConnected(true);
    });
    socket.addEventListener("close", () => {
      console.log("[YellowProvider] WebSocket closed");
      setIsConnected(false);
    });
    socket.addEventListener("error", (event) => {
      console.warn("[YellowProvider] WebSocket error", event);
      setIsConnected(false);
    });

    setWs(socket);

    return () => {
      console.log("[YellowProvider] Closing WebSocket");
      socket.close();
    };
  }, []);

  const messageSigner = useCallback(async (payload: string) => {
    return signSessionMessage(payload);
  }, []);

  const openChannel = useCallback(async () => {
    if (!walletClient || !address) {
      throw new Error("Connect a wallet before opening a channel.");
    }
    console.log("[YellowProvider] Opening channel for", address);
    return sdkOpenChannel({
      clearnodeUrl: CLEARNODE_URL,
      walletClient,
      address,
      application: "Yellow Auction",
      scope: "auction.app",
    });
  }, [walletClient, address]);

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
