"use client";

import "@rainbow-me/rainbowkit/styles.css";
import React from "react";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { sepolia } from "wagmi/chains";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "MISSING_PROJECT_ID";

const config = getDefaultConfig({
  appName: "YellowAuction",
  projectId,
  chains: [sepolia],
  ssr: true,
});

const queryClient = new QueryClient();

type Web3ProviderProps = {
  children: React.ReactNode;
};

export function Web3Provider({ children }: Web3ProviderProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
