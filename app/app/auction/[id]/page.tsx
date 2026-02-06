"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bolt,
  Gavel,
  ShieldCheck,
  Timer,
  Wallet,
  Waves,
} from "lucide-react";
import { useAuctionSession } from "../../hooks/useAuctionSession";
import { useYellow } from "../../hooks/useYellow";

export default function AuctionDetailPage() {
  const {
    currentPrice,
    formattedTime,
    timeLeft,
    lastBidder,
    history,
    placeBid,
  } = useAuctionSession("aurora");
  const { transfer } = useYellow();
  const [isSigning, setIsSigning] = useState(false);
  const [transferAddress, setTransferAddress] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  const handleBid = async () => {
    if (isSigning) return;
    setIsSigning(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    await placeBid();
    setIsSigning(false);
  };

  const handleSend = async () => {
    if (isSending) return;
    setSendError(null);
    setSendSuccess(null);

    const trimmedAddress = transferAddress.trim();
    const trimmedAmount = transferAmount.trim();
    const amountValue = Number(trimmedAmount);
    if (!trimmedAddress) {
      setSendError("Enter a destination address.");
      return;
    }
    if (!trimmedAmount || Number.isNaN(amountValue) || amountValue <= 0) {
      setSendError("Enter a valid amount.");
      return;
    }

    setIsSending(true);
    try {
      await transfer(trimmedAddress as `0x${string}`, trimmedAmount);
      setSendSuccess("Transfer sent.");
      setTransferAmount("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send transfer.";
      setSendError(message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1.4fr_0.9fr]">
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
                Retail value $289 · Session ID AUC-91F1
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-zinc-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Channel: Synced
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-amber-400/20 via-transparent to-transparent p-6">
              <div className="absolute right-6 top-6 flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs text-zinc-200">
                <Waves className="h-4 w-4 text-amber-300" />
                State Channel
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
                    Last Bidder
                  </p>
                  <p className="mt-2 font-mono text-sm text-amber-200">
                    {lastBidder ?? "—"}
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
                  Every bid extends the window to 15 seconds.
                </p>
              </div>

              <button
                onClick={handleBid}
                className="relative overflow-hidden rounded-2xl bg-amber-400 px-5 py-4 text-lg font-semibold text-slate-950 shadow-[0_20px_60px_-30px_rgba(250,204,21,0.8)] transition hover:bg-amber-300 disabled:cursor-wait"
                disabled={isSigning}
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
                      Bid Now
                    </>
                  )}
                </span>
                <span className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.4),_transparent_55%)] opacity-70" />
              </button>

              <div className="grid gap-3 text-sm text-zinc-400">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />
                  Bids are escrowed via unified balance.
                </div>
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-amber-300" />
                  Estimated bid fee: $0.01.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside className="space-y-6">
        <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                Live State Channel Feed
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                Bid History
              </p>
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

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
            Send Transfer
          </p>
          <p className="mt-2 text-lg font-semibold text-white">
            Wallet payout
          </p>

          <div className="mt-5 grid gap-3">
            <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Destination address
            </label>
            <input
              value={transferAddress}
              onChange={(event) => setTransferAddress(event.target.value)}
              placeholder="0x..."
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-300/60 focus:outline-none"
            />
            <label className="mt-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
              Amount (ytest.usd)
            </label>
            <input
              value={transferAmount}
              onChange={(event) => setTransferAmount(event.target.value)}
              placeholder="10"
              inputMode="decimal"
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-300/60 focus:outline-none"
            />

            <button
              onClick={handleSend}
              disabled={isSending}
              className="mt-2 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/20 disabled:cursor-wait"
            >
              {isSending ? "Sending..." : "Send transfer"}
            </button>

            {sendError ? (
              <p className="text-xs text-red-300">{sendError}</p>
            ) : null}
            {sendSuccess ? (
              <p className="text-xs text-emerald-300">{sendSuccess}</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-amber-400/10 via-transparent to-transparent p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-200">
            Session Metrics
          </p>
          <div className="mt-4 grid gap-3 text-sm text-zinc-300">
            <div className="flex items-center justify-between">
              <span>State updates</span>
              <span className="font-semibold text-white">128</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Average latency</span>
              <span className="font-semibold text-white">92ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Channel escrow</span>
              <span className="font-semibold text-white">$18.40</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
