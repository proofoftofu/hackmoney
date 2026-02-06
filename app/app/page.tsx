"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ArrowUpRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useYellow } from "./hooks/useYellow";

export default function Home() {
  const { hasWallet, isConnected, isConnecting, connectSession, getUnifiedBalance, walletAddress } =
    useYellow();
  const [unifiedBalance, setUnifiedBalance] = useState<number | null>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [isFaucetLoading, setIsFaucetLoading] = useState(false);

  const refreshBalance = useCallback(async () => {
    setIsBalanceLoading(true);
    setBalanceError(null);
    const balance = await getUnifiedBalance();
    if (balance === null) {
      setBalanceError("Unable to load unified balance.");
    }
    setUnifiedBalance(balance);
    setIsBalanceLoading(false);
  }, [getUnifiedBalance]);

  useEffect(() => {
    if (!isConnected) {
      setUnifiedBalance(null);
      return;
    }
    refreshBalance();
  }, [isConnected, refreshBalance]);

  const needsFaucet = useMemo(
    () => unifiedBalance !== null && unifiedBalance <= 0,
    [unifiedBalance]
  );

  const requestFaucet = async () => {
    if (!walletAddress) return;
    setIsFaucetLoading(true);
    setBalanceError(null);
    try {
      const response = await fetch(
        "https://clearnet-sandbox.yellow.com/faucet/requestTokens",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userAddress: walletAddress }),
        }
      );
      if (!response.ok) {
        throw new Error(`Faucet request failed (${response.status})`);
      }
      await refreshBalance();
    } catch (error) {
      setBalanceError(
        error instanceof Error ? error.message : "Faucet request failed."
      );
    } finally {
      setIsFaucetLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <section className="rounded-[32px] border border-white/10 bg-slate-950/80 p-8 shadow-[0_30px_80px_-45px_rgba(250,204,21,0.6)]">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-300">
          Penny Auction
        </p>
        <h1 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">
          Bid fast. Win faster.
          <span className="block text-amber-300">State channel speed.</span>
        </h1>
        <p className="mt-4 max-w-xl text-base text-zinc-400">
          Yellow Network powers lightning bids with unified balances, enabling
          sub-second auctions and instant payouts.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <ConnectButton.Custom>
            {({ account, chain, mounted, openConnectModal }) => {
              const ready = mounted;
              const connected = ready && account && chain;

              return (
                <div className={ready ? "" : "pointer-events-none opacity-0"}>
                  {!connected ? (
                    <button
                      type="button"
                      onClick={openConnectModal}
                      className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
                    >
                      Connect Wallet
                    </button>
                  ) : !isConnected ? (
                    <button
                      type="button"
                      onClick={async () => {
                        if (isConnecting || !hasWallet) return;
                        await connectSession();
                      }}
                      disabled={isConnecting || !hasWallet}
                      className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-amber-400/40"
                    >
                      {isConnecting ? "Signing In..." : "Sign In"}
                    </button>
                  ) : (
                    <Link
                      href="/auction/aurora"
                      className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
                    >
                      Enter Auction
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              );
            }}
          </ConnectButton.Custom>
          {isConnected && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-300">
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                {isBalanceLoading
                  ? "Loading balance..."
                  : unifiedBalance === null
                  ? "Balance unavailable"
                  : `Unified balance: ${unifiedBalance.toFixed(2)} USDC`}
              </span>
              {needsFaucet && (
                <button
                  type="button"
                  onClick={requestFaucet}
                  disabled={isFaucetLoading}
                  className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:border-amber-400 hover:text-amber-100 disabled:cursor-not-allowed disabled:border-amber-400/20 disabled:text-amber-200/60"
                >
                  {isFaucetLoading ? "Requesting USDC..." : "Request Test USDC"}
                </button>
              )}
            </div>
          )}
        </div>
        {balanceError && (
          <p className="mt-3 text-sm text-rose-300">{balanceError}</p>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-200">
            How It Works
          </p>
          <p className="mt-3 text-base text-zinc-300">
            Each bid adds $0.01 and resets the countdown. When the timer reaches
            zero, the last bidder wins the product.
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-200">
            Penny Auction Benefits
          </p>
          <p className="mt-3 text-base text-zinc-300">
            Low-cost entry, fast-paced bidding, and the chance to win premium
            items for a fraction of retail.
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-200">
            Why Yellow Network
          </p>
          <p className="mt-3 text-base text-zinc-300">
            Instant and secure by Yellow Network state channels and app sessions,
            keeping bids signed, verified, and confirmed in real time.
          </p>
        </div>
      </section>
    </div>
  );
}
