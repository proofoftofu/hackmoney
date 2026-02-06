"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bolt,
  Gavel,
  ShieldCheck,
  Timer,
  Waves,
} from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useParams } from "next/navigation";
import { useAuctionSession } from "../../hooks/useAuctionSession";
import { useYellow } from "../../hooks/useYellow";

const DEFAULT_SELLER: `0x${string}` =
  "0xd801330692189B98a47b4676aa759fD16bB47d02";

export default function AuctionDetailPage() {
  const params = useParams<{ id: string }>();
  const auctionId = useMemo(() => {
    const raw = params?.id;
    if (Array.isArray(raw)) return raw[0] ?? "aurora";
    return raw ?? "aurora";
  }, [params]);
  const sellerAddress = DEFAULT_SELLER;
  const {
    sessionId,
    currentPrice,
    formattedTime,
    timeLeft,
    lastBidder,
    history,
    createSession,
    placeBid,
    closeOrder,
    budget,
    totalFees,
  } = useAuctionSession(auctionId, sellerAddress);
  const {
    hasWallet,
    isConnected,
    isConnecting,
    connectSession,
    getUnifiedBalance,
    walletAddress,
  } = useYellow();
  const [isSigning, setIsSigning] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [unifiedBalance, setUnifiedBalance] = useState<number | null>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [isFaucetLoading, setIsFaucetLoading] = useState(false);
  const [budgetInput, setBudgetInput] = useState("100");
  const isEnded = timeLeft === 0;

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

  const needsFaucet = useMemo(
    () => unifiedBalance !== null && unifiedBalance <= 0,
    [unifiedBalance]
  );

  const handleBid = async () => {
    if (isSigning) return;
    setIsSigning(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    await placeBid();
    setIsSigning(false);
  };

  const handleProceed = async () => {
    if (isClosing || isClosed) return;
    setIsClosing(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    const signature = await closeOrder();
    setIsClosing(false);
    if (signature) {
      setIsClosed(true);
    }
  };

  const handleTryAgain = () => {
    window.location.reload();
  };

  if (!hasWallet) {
    return (
      <div className="mx-auto max-w-3xl rounded-[32px] border border-white/10 bg-slate-950/80 p-8 text-center shadow-[0_30px_80px_-45px_rgba(250,204,21,0.6)]">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-300">
          Wallet Required
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-white">
          Connect your wallet to enter the auction.
        </h1>
        <p className="mt-3 text-sm text-zinc-400">
          You can create a session after your wallet is connected.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <ConnectButton.Custom>
            {({ account, chain, mounted, openConnectModal }) => {
              const ready = mounted;
              const connected = ready && account && chain;

              return (
                <div className={ready ? "" : "pointer-events-none opacity-0"}>
                  <button
                    type="button"
                    onClick={openConnectModal}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
                  >
                    {connected ? "Wallet Connected" : "Connect Wallet"}
                  </button>
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {isClosed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950/95 p-8 text-center shadow-[0_30px_80px_-45px_rgba(250,204,21,0.6)]">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-300">
              Thank You
            </p>
            <h2 className="mt-4 text-3xl font-semibold text-white">
              Hope you enjoyed penny auction with Yellow Network.
            </h2>
            <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left text-sm text-zinc-300">
              <div className="flex items-center justify-between">
                <span>Total tx count</span>
                <span className="font-semibold text-white">{history.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Total balance change</span>
                <span className="font-semibold text-white">
                  ${(currentPrice + totalFees).toFixed(2)} paid
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Remaining budget</span>
                <span className="font-semibold text-white">
                  ${(budget - (currentPrice + totalFees)).toFixed(2)} sent back to unified account
                </span>
              </div>
            </div>
            <p className="mt-4 text-sm text-zinc-400">
              In the hackathon only one user makes bids, but in the real app it
              would accept multiple users, and it&apos;s going to be fun.
            </p>
            <button
              type="button"
              onClick={handleTryAgain}
              className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
            >
              Try One More Time
            </button>
          </div>
        </div>
      )}
      <section className="space-y-6">
        <div className="rounded-[32px] border border-white/10 bg-slate-950/80 p-8">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-amber-300">
                Live Auction
              </p>
              <h1 className="mt-3 text-4xl font-semibold text-white">
                Aurora Smartwatch
              </h1>
              <p className="mt-2 text-sm text-zinc-400">
                Retail value $289 · Buying Session {sessionId ?? "Pending"}
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-zinc-300">
              <span
                className={`h-2 w-2 rounded-full ${
                  isConnected ? "bg-emerald-400" : "bg-amber-300"
                }`}
              />
              Session: {isConnected ? "Active" : "Not Created"}
            </div>
          </div>

          {!isConnected && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-amber-400/30 bg-amber-300/10 p-5 text-sm text-amber-100">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-amber-200">
                  Authentication Required
                </p>
                <p className="mt-2 text-base font-semibold text-white">
                  Authenticate to open your session.
                </p>
                <p className="mt-1 text-sm text-amber-100/80">
                  Sessions only apply to this auction.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (isConnecting) return;
                  await connectSession();
                }}
                disabled={isConnecting}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isConnecting ? "Authenticating..." : "Authenticate"}
              </button>
            </div>
          )}

          {isConnected && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-black/40 p-5 text-sm text-zinc-300">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Unified Balance
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {isBalanceLoading
                    ? "Loading..."
                    : unifiedBalance === null
                    ? "Unavailable"
                    : `${unifiedBalance.toFixed(2)} USDC`}
                </p>
                {balanceError && (
                  <p className="mt-2 text-sm text-rose-300">{balanceError}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={refreshBalance}
                  disabled={isBalanceLoading}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-100 transition hover:border-amber-300/40 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Refresh
                </button>
                {needsFaucet && (
                  <button
                    type="button"
                    onClick={requestFaucet}
                    disabled={isFaucetLoading}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isFaucetLoading
                      ? "Requesting USDC..."
                      : "Request Test USDC"}
                  </button>
                )}
              </div>
            </div>
          )}

          {isConnected && !sessionId && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-zinc-300">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                  Auction Not Started
                </p>
                <p className="mt-2 text-base font-semibold text-white">
                  Start the auction session to begin the timer.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                    Budget (USD)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={budgetInput}
                    onChange={(event) => setBudgetInput(event.target.value)}
                    className="h-10 w-32 rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white outline-none transition focus:border-amber-300/60"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const parsed = Number(budgetInput);
                  await createSession(Number.isFinite(parsed) ? parsed : budget);
                }}
                disabled={!budgetInput || Number(budgetInput) <= 0}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start Auction
              </button>
            </div>
          )}

          {sessionId && (
            <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-amber-400/20 via-transparent to-transparent p-6">
                <div className="absolute right-6 top-6 flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs text-zinc-200">
                  <Waves className="h-4 w-4 text-amber-300" />
                  Buying Session
                </div>
                <div className="mt-10 flex h-56 items-center justify-center rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.25),_transparent_60%)] text-4xl font-semibold text-amber-200">
                  AUR-01
                </div>
              <div className="mt-6 flex flex-wrap items-center gap-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Current Price
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-white">
                    ${currentPrice.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Accumulated Fee
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-white">
                    ${totalFees.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Last Bidder
                  </p>
                  <p className="mt-2 font-mono text-sm text-amber-200">
                    {lastBidder ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Seller
                  </p>
                  <p className="mt-2 font-mono text-sm text-amber-200">
                    {sellerAddress}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between gap-6 rounded-3xl border border-white/10 bg-black/40 p-6">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Countdown
                </p>
                  <motion.div
                    key={timeLeft}
                    initial={{ scale: 0.96, opacity: 0.7 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.25 }}
                    className="mt-3 inline-flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-300/10 px-4 py-3 text-3xl font-semibold text-amber-200"
                  >
                    <Timer className="h-6 w-6" />
                    {formattedTime}
                  </motion.div>
                <p className="mt-4 text-sm text-zinc-400">
                  Bid fee $1.00 · Bid increment $0.01 · Every bid extends the window to 15 seconds.
                </p>
              </div>

                <button
                  onClick={handleBid}
                  className="relative overflow-hidden rounded-2xl bg-amber-400 px-5 py-4 text-lg font-semibold text-slate-950 shadow-[0_20px_60px_-30px_rgba(250,204,21,0.8)] transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSigning || isEnded || !isConnected || !sessionId}
                >
                  <span className="relative z-10 flex items-center justify-center gap-3">
                    {isSigning ? (
                      <>
                        <Bolt className="h-5 w-5 animate-pulse" />
                        Signing Transaction...
                      </>
                    ) : (
                      <>
                        <Gavel className="h-5 w-5" />
                        {isEnded
                          ? "Auction Ended"
                          : !isConnected || !sessionId
                          ? "Create Session to Bid"
                          : "Bid Now"}
                      </>
                    )}
                  </span>
                  <span className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.4),_transparent_55%)] opacity-70" />
                </button>

                {isEnded && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
                    <p className="font-semibold text-white">Auction ended</p>
                    <p className="mt-2 text-zinc-400">You can get the product now.</p>
                    <button
                      onClick={handleProceed}
                      className="mt-4 w-full cursor-pointer rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-200 transition hover:border-amber-400 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isClosing || isClosed}
                    >
                      {isClosed
                        ? "Order Closed"
                        : isClosing
                        ? "Processing Payment..."
                        : "Proceed to Buy"}
                    </button>
                  </div>
                )}

                <div className="grid gap-3 text-sm text-zinc-400">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-300" />
                    Bids update the app session state.
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-amber-300" />
                    Seller participates as a signed session member.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-6">
        {sessionId && (
          <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                  Live Session Feed
                </p>
                <p className="mt-2 text-lg font-semibold text-white">Bid History</p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-amber-200">
                {history.length} events
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <AnimatePresence initial={false}>
                {history.map((entry) => (
                  <motion.div
                    key={entry.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">
                        ${(entry.state?.currentPrice ?? 0).toFixed(2)} bid
                      </p>
                      <p className="text-xs font-mono text-amber-200">
                        {entry.state?.lastBidder ?? "—"}
                      </p>
                    </div>
                    <div className="text-xs text-zinc-400">
                      v{entry.version ?? 0}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
