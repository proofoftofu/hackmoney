"use client";

import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import {
  detectOpenChannel as sdkDetectOpenChannel,
  deposit as sdkDeposit,
  getActiveSession,
  getDepositBalance as sdkGetDepositBalance,
  getLedgerBalances as sdkGetLedgerBalances,
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
  channelBalance: number;
  depositBalance: number;
  isRefreshingBalances: boolean;
  refreshBalances: () => Promise<void>;
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
  const [unifiedBalance, setUnifiedBalance] = useState(0);
  const [channelBalance, setChannelBalance] = useState(0);
  const [depositBalance, setDepositBalance] = useState(0);
  const [isRefreshingBalances, setIsRefreshingBalances] = useState(false);
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
      setUnifiedBalance(0);
      setChannelBalance(0);
      setDepositBalance(0);
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
      .then(async (detectedChannelId) => {
        if (!isMounted) return;
        setChannelId(detectedChannelId ?? null);
        const session = getActiveSession();
        if (session?.ws) {
          setWs(session.ws);
        }
        setIsRefreshingBalances(true);
        const [ledgerResult, depositResult] = await Promise.allSettled([
          sdkGetLedgerBalances(),
          sdkGetDepositBalance(),
        ]);
        if (!isMounted) return;
        if (ledgerResult.status === "fulfilled") {
          const balances = ledgerResult.value;
          setUnifiedBalance(balances.unifiedBalance);
          setChannelBalance(balances.channelBalance);
          if (balances.channelId && !detectedChannelId) {
            setChannelId(balances.channelId);
          }
        } else {
          console.warn(
            "[YellowProvider] Failed to refresh ledger balances",
            ledgerResult.reason
          );
        }
        if (depositResult.status === "fulfilled") {
          setDepositBalance(depositResult.value.custodyBalance);
        } else {
          console.warn(
            "[YellowProvider] Failed to refresh deposit balance",
            depositResult.reason
          );
        }
        if (isMounted) setIsRefreshingBalances(false);
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
    setIsRefreshingBalances(true);
    const [ledgerResult, depositResult] = await Promise.allSettled([
      sdkGetLedgerBalances(),
      sdkGetDepositBalance(),
    ]);
    if (ledgerResult.status === "fulfilled") {
      setUnifiedBalance(ledgerResult.value.unifiedBalance);
      setChannelBalance(ledgerResult.value.channelBalance);
    } else {
      console.warn(
        "[YellowProvider] Failed to refresh ledger balances after open",
        ledgerResult.reason
      );
    }
    if (depositResult.status === "fulfilled") {
      setDepositBalance(depositResult.value.custodyBalance);
    } else {
      console.warn(
        "[YellowProvider] Failed to refresh deposit balance after open",
        depositResult.reason
      );
    }
    setIsRefreshingBalances(false);
    return channelId;
  }, [walletClient, address]);

  const refreshBalances = useCallback(async () => {
    setIsRefreshingBalances(true);
    try {
      const [ledgerResult, depositResult] = await Promise.allSettled([
        sdkGetLedgerBalances(),
        sdkGetDepositBalance(),
      ]);
      if (ledgerResult.status === "fulfilled") {
        const balances = ledgerResult.value;
        setUnifiedBalance(balances.unifiedBalance);
        setChannelBalance(balances.channelBalance);
        if (balances.channelId && !channelId) {
          setChannelId(balances.channelId);
        }
      } else {
        console.warn(
          "[YellowProvider] Failed to refresh ledger balances",
          ledgerResult.reason
        );
      }
      if (depositResult.status === "fulfilled") {
        setDepositBalance(depositResult.value.custodyBalance);
      } else {
        console.warn(
          "[YellowProvider] Failed to refresh deposit balance",
          depositResult.reason
        );
      }
    } finally {
      setIsRefreshingBalances(false);
    }
  }, [channelId]);

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
      setChannelBalance(0);
    } finally {
      setIsClosing(false);
    }
  }, [channelId]);

  const deposit = useCallback(
    async (amount: number) => {
    await sdkDeposit(amount);
    try {
      await refreshBalances();
    } catch (error) {
      console.warn("[YellowProvider] Failed to refresh balances after top up", error);
    }
    },
    [refreshBalances]
  );

  const withdraw = useCallback(
    async (amount: number) => {
    await sdkWithdraw(amount);
    try {
      await refreshBalances();
    } catch (error) {
      console.warn("[YellowProvider] Failed to refresh balances after withdraw", error);
    }
    },
    [refreshBalances]
  );

  const value = useMemo<YellowContextValue>(
    () => ({
      ws,
      isConnected,
      hasWallet,
      channelId,
      isDetectingChannel,
      unifiedBalance,
      channelBalance,
      depositBalance,
      isRefreshingBalances,
      refreshBalances,
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
      channelBalance,
      depositBalance,
      isRefreshingBalances,
      refreshBalances,
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
