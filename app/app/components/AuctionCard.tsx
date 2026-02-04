"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CircleDollarSign, Timer } from "lucide-react";
import { useAuction } from "../hooks/useAuction";

type AuctionCardProps = {
  id: string;
  title: string;
  retailValue: string;
  startingPrice: number;
  accent?: string;
};

export function AuctionCard({
  id,
  title,
  retailValue,
  startingPrice,
  accent = "from-amber-500/20 via-amber-400/10 to-transparent",
}: AuctionCardProps) {
  const { price, formattedTime, lastBidder, timeLeft } = useAuction({
    startingPrice,
    autoReset: true,
  });

  return (
    <Link
      href={`/auction/${id}`}
      className="group relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.9)] transition hover:-translate-y-1 hover:border-amber-400/40"
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-0 transition duration-500 group-hover:opacity-100`}
      />
      <div className="relative z-10 flex flex-col gap-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              Live Auction
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white">{title}</h3>
            <p className="mt-1 text-sm text-zinc-400">Retail {retailValue}</p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-amber-300">
            <CircleDollarSign className="h-6 w-6" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Current Price
            </p>
            <p className="mt-3 text-3xl font-semibold text-white">
              ${price.toFixed(2)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Last Bidder
            </p>
            <p className="mt-3 font-mono text-sm text-amber-200">
              {lastBidder}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <Timer className="h-4 w-4 text-amber-300" />
            Countdown
          </div>
          <motion.div
            key={timeLeft}
            initial={{ scale: 0.95, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.35 }}
            className="rounded-full border border-amber-400/40 bg-amber-300/10 px-3 py-1 text-sm font-semibold text-amber-200"
          >
            {formattedTime}
          </motion.div>
        </div>
      </div>
    </Link>
  );
}
