"use client";

import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import type { RPCResponse } from "@erc7824/nitrolite";
import {
  closeAppSession as sdkCloseAppSession,
  connectYellowSession,
  createAppSession as sdkCreateAppSession,
  disconnectYellowSession,
  getActiveSession,
  submitAppState as sdkSubmitAppState,
  subscribeToMessages,
  type CloseAppSessionInput,
  type CreateAppSessionInput,
  type CreateAppSessionResult,
  type SubmitAppStateInput,
} from "../lib/yellowClient";

type YellowContextValue = {
  isConnected: boolean;
  isConnecting: boolean;
  hasWallet: boolean;
  walletAddress: `0x${string}` | null;
  sessionAddress: `0x${string}` | null;
  authStep: "idle" | "request" | "challenge" | "verify" | "success" | "error";
  authError: string | null;
  connectSession: () => Promise<void>;
  disconnectSession: () => Promise<void>;
  createAppSession: (input: CreateAppSessionInput) => Promise<CreateAppSessionResult>;
  submitAppState: (input: SubmitAppStateInput) => Promise<void>;
  closeAppSession: (input: CloseAppSessionInput) => Promise<void>;
  subscribe: (handler: (message: RPCResponse) => void) => () => void;
};

export const YellowContext = createContext<YellowContextValue | null>(null);

const CLEARNODE_URL = "wss://clearnet-sandbox.yellow.com/ws";

type YellowProviderProps = {
  children: React.ReactNode;
};

export function YellowProvider({ children }: YellowProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionAddress, setSessionAddress] = useState<`0x${string}` | null>(null);
  const [authStep, setAuthStep] = useState<
    "idle" | "request" | "challenge" | "verify" | "success" | "error"
  >("idle");
  const [authError, setAuthError] = useState<string | null>(null);

  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const hasWallet = Boolean(walletClient && address);

  useEffect(() => {
    if (authStep !== "success") return;
    const timeout = setTimeout(() => setAuthStep("idle"), 900);
    return () => clearTimeout(timeout);
  }, [authStep]);

  const connectSession = useCallback(async () => {
    if (!walletClient || !address) {
      throw new Error("Connect a wallet before opening a Yellow session.");
    }

    console.log("[yellow] connectSession");
    setIsConnecting(true);
    try {
      await connectYellowSession({
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
      console.log("[yellow] session connected", {
        walletAddress: address,
        sessionAddress: session?.sessionAddress,
      });
      setSessionAddress(session?.sessionAddress ?? null);
      setIsConnected(true);
    } finally {
      setIsConnecting(false);
    }
  }, [walletClient, address]);

  const disconnectSession = useCallback(async () => {
    console.log("[yellow] disconnectSession");
    setIsConnecting(true);
    try {
      await disconnectYellowSession();
      console.log("[yellow] session disconnected");
      setIsConnected(false);
      setSessionAddress(null);
      setAuthStep("idle");
      setAuthError(null);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  useEffect(() => {
    if (!walletClient || !address) {
      console.log("[yellow] wallet not connected, resetting session state");
      setIsConnected(false);
      setSessionAddress(null);
      setAuthStep("idle");
      setAuthError(null);
      return;
    }

    let isMounted = true;
    connectSession().catch((error) => {
      if (!isMounted) return;
      console.warn("[YellowProvider] Failed to connect", error);
    });

    return () => {
      isMounted = false;
    };
  }, [walletClient, address, connectSession]);

  const createAppSession = useCallback(async (input: CreateAppSessionInput) => {
    console.log("[yellow] createAppSession", input);
    return sdkCreateAppSession(input);
  }, []);

  const submitAppState = useCallback(async (input: SubmitAppStateInput) => {
    console.log("[yellow] submitAppState", input);
    await sdkSubmitAppState(input);
  }, []);

  const closeAppSession = useCallback(async (input: CloseAppSessionInput) => {
    console.log("[yellow] closeAppSession", input);
    await sdkCloseAppSession(input);
  }, []);

  const subscribe = useCallback(
    (handler: (message: RPCResponse) => void) => {
      console.log("[yellow] subscribe");
      return subscribeToMessages(handler);
    },
    []
  );

  const value = useMemo<YellowContextValue>(
    () => ({
      isConnected,
      isConnecting,
      hasWallet,
      walletAddress: (address as `0x${string}` | undefined) ?? null,
      sessionAddress,
      authStep,
      authError,
      connectSession,
      disconnectSession,
      createAppSession,
      submitAppState,
      closeAppSession,
      subscribe,
    }),
    [
      isConnected,
      isConnecting,
      hasWallet,
      address,
      sessionAddress,
      authStep,
      authError,
      connectSession,
      disconnectSession,
      createAppSession,
      submitAppState,
      closeAppSession,
      subscribe,
    ]
  );

  return (
    <YellowContext.Provider value={value}>{children}</YellowContext.Provider>
  );
}
