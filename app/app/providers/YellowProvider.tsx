"use client";

import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import {
  detectOpenChannel as sdkDetectOpenChannel,
  deposit as sdkDeposit,
  getActiveSession,
  openChannel as sdkOpenChannel,
  closeChannel as sdkCloseChannel,
  signSessionMessage,
  withdraw as sdkWithdraw,
} from "../lib/yellowClient";

type YellowContextValue = {
  ws: WebSocket | null;
  isConnected: boolean;
  hasWallet: boolean;
  channelId: string | null;
  isDetectingChannel: boolean;
  unifiedBalance: number;
  setUnifiedBalance: (next: number) => void;
  authStep: "idle" | "request" | "challenge" | "verify" | "success" | "error";
  authError: string | null;
  messageSigner: (payload: string) => Promise<string>;
  openChannel: () => Promise<string>;
  closeChannel: () => Promise<void>;
  deposit: (amount: number) => Promise<void>;
  withdraw: (amount: number) => Promise<void>;
  isClosing: boolean;
};

export const YellowContext = createContext<YellowContextValue | null>(null);

const CLEARNODE_URL = "wss://clearnet-sandbox.yellow.com/ws";

type YellowProviderProps = {
  children: React.ReactNode;
};

export function YellowProvider({ children }: YellowProviderProps) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [isDetectingChannel, setIsDetectingChannel] = useState(false);
  const [unifiedBalance, setUnifiedBalance] = useState(18.4);
  const [authStep, setAuthStep] = useState<
    "idle" | "request" | "challenge" | "verify" | "success" | "error"
  >("idle");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const hasWallet = Boolean(walletClient && address);

  useEffect(() => {
    if (authStep !== "success") return;
    const timeout = setTimeout(() => setAuthStep("idle"), 900);
    return () => clearTimeout(timeout);
  }, [authStep]);

  useEffect(() => {
    if (!walletClient || !address) {
      setChannelId(null);
      setWs(null);
      setIsConnected(false);
      setAuthStep("idle");
      setAuthError(null);
      return;
    }

    let isMounted = true;
    setIsDetectingChannel(true);
    sdkDetectOpenChannel({
      clearnodeUrl: CLEARNODE_URL,
      walletClient,
      address,
      application: "Yellow Auction",
      scope: "auction.app",
      onAuthRequest: () => {
        setAuthError(null);
        setAuthStep("request");
      },
      onAuthChallenge: () => setAuthStep("challenge"),
      onAuthVerify: () => setAuthStep("verify"),
      onAuthSuccess: () => setAuthStep("success"),
      onAuthError: (error) => {
        setAuthError(error.message);
        setAuthStep("error");
      },
    })
      .then((detectedChannelId) => {
        if (!isMounted) return;
        setChannelId(detectedChannelId ?? null);
        const session = getActiveSession();
        if (session?.ws) {
          setWs(session.ws);
        }
      })
      .catch((error) => {
        if (!isMounted) return;
        console.warn("[YellowProvider] Failed to detect open channel", error);
        setChannelId(null);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsDetectingChannel(false);
      });

    return () => {
      isMounted = false;
    };
  }, [walletClient, address]);

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
      onAuthRequest: () => {
        setAuthError(null);
        setAuthStep("request");
      },
      onAuthChallenge: () => setAuthStep("challenge"),
      onAuthVerify: () => setAuthStep("verify"),
      onAuthSuccess: () => setAuthStep("success"),
      onAuthError: (error) => {
        setAuthError(error.message);
        setAuthStep("error");
      },
    });
    const session = getActiveSession();
    if (session?.ws) {
      setWs(session.ws);
    }
    setChannelId(channelId);
    return channelId;
  }, [walletClient, address]);

  const closeChannel = useCallback(async () => {
    if (!channelId) {
      throw new Error("No active session to close.");
    }
    setIsClosing(true);
    try {
      await sdkCloseChannel();
      setChannelId(null);
      setWs(null);
      setIsConnected(false);
    } finally {
      setIsClosing(false);
    }
  }, [channelId]);

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
      channelId,
      isDetectingChannel,
      unifiedBalance,
      setUnifiedBalance,
      authStep,
      authError,
      messageSigner,
      openChannel,
      closeChannel,
      deposit,
      withdraw,
      isClosing,
    }),
    [
      ws,
      isConnected,
      hasWallet,
      channelId,
      isDetectingChannel,
      unifiedBalance,
      authStep,
      authError,
      messageSigner,
      openChannel,
      closeChannel,
      deposit,
      withdraw,
      isClosing,
    ]
  );

  return (
    <YellowContext.Provider value={value}>{children}</YellowContext.Provider>
  );
}
