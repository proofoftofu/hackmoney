"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bolt,
  Gavel,
  ShieldCheck,
  Timer,
  Waves,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useAuctionSession } from "../../hooks/useAuctionSession";
import { useYellow } from "../../hooks/useYellow";

const DEFAULT_SELLER: `0x${string}` =
  "0xF39fd6e51aad88F6F4ce6aB8827279cffFb92266";

const AUCTION_SELLERS: Record<string, `0x${string}`> = {
  aurora: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
  zenith: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
  lumen: "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
  pulse: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
};

export default function AuctionDetailPage() {
  const params = useParams<{ id: string }>();
  const auctionId = useMemo(() => {
    const raw = params?.id;
    if (Array.isArray(raw)) return raw[0] ?? "aurora";
    return raw ?? "aurora";
  }, [params]);
  const sellerAddress = AUCTION_SELLERS[auctionId] ?? DEFAULT_SELLER;
  const {
    sessionId,
    currentPrice,
    formattedTime,
    timeLeft,
    lastBidder,
    history,
    placeBid,
    closeOrder,
  } = useAuctionSession(auctionId, sellerAddress);
  const { isConnected } = useYellow();
  const [isSigning, setIsSigning] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const isEnded = timeLeft === 0;

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
                Retail value $289 · Session ID {sessionId ?? "Pending"}
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-zinc-300">
              <span
                className={`h-2 w-2 rounded-full ${
                  isConnected ? "bg-emerald-400" : "bg-amber-300"
                }`}
              />
              Session: {isConnected ? "Live" : "Waiting"}
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-amber-400/20 via-transparent to-transparent p-6">
              <div className="absolute right-6 top-6 flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs text-zinc-200">
                <Waves className="h-4 w-4 text-amber-300" />
                App Session
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
                disabled={isSigning || isEnded}
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
                      {isEnded ? "Auction Ended" : "Bid Now"}
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
                    className="mt-4 w-full rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-200 transition hover:border-amber-400 hover:text-amber-100 disabled:cursor-wait"
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
        </div>
      </section>

      <aside className="space-y-6">
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

        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-amber-400/10 via-transparent to-transparent p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-200">
            Session Metrics
          </p>
          <div className="mt-4 grid gap-3 text-sm text-zinc-300">
            <div className="flex items-center justify-between">
              <span>State updates</span>
              <span className="font-semibold text-white">{history.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Latest version</span>
              <span className="font-semibold text-white">
                {history[0]?.version ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Seller address</span>
              <span className="font-mono text-xs text-amber-200">
                {sellerAddress}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
