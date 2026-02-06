"use client";

import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import {
  deposit as sdkDeposit,
  getActiveSession,
  openChannel as sdkOpenChannel,
  signSessionMessage,
  withdraw as sdkWithdraw,
} from "../lib/yellowClient";

type YellowContextValue = {
  ws: WebSocket | null;
  isConnected: boolean;
  hasWallet: boolean;
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
  const hasWallet = Boolean(walletClient && address);

  useEffect(() => {
    if (!ws) return;

    console.log("[YellowProvider] Attaching WebSocket listeners");
    const handleOpen = () => {
      console.log("[YellowProvider] WebSocket connected");
      setIsConnected(true);
    };
    const handleClose = () => {
      console.log("[YellowProvider] WebSocket closed");
      setIsConnected(false);
    };
    const handleError = (event: Event) => {
      console.warn("[YellowProvider] WebSocket error", event);
      setIsConnected(false);
    };

    if (ws.readyState === WebSocket.OPEN) {
      setIsConnected(true);
    }

    ws.addEventListener("open", handleOpen);
    ws.addEventListener("close", handleClose);
    ws.addEventListener("error", handleError);

    return () => {
      ws.removeEventListener("open", handleOpen);
      ws.removeEventListener("close", handleClose);
      ws.removeEventListener("error", handleError);
    };
  }, [ws]);

  const messageSigner = useCallback(async (payload: string) => {
    return signSessionMessage(payload);
  }, []);

  const openChannel = useCallback(async () => {
    if (!walletClient || !address) {
      throw new Error("Connect a wallet before opening a channel.");
    }
    console.log("[YellowProvider] Opening channel for", address);
    const channelId = await sdkOpenChannel({
      clearnodeUrl: CLEARNODE_URL,
      walletClient,
      address,
      application: "Yellow Auction",
      scope: "auction.app",
    });
    const session = getActiveSession();
    if (session?.ws) {
      setWs(session.ws);
    }
    return channelId;
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
      hasWallet,
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
      hasWallet,
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
