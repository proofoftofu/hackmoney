"use client";

import Link from "next/link";
import { ArrowUpRight, Timer } from "lucide-react";
import { useAuction } from "./hooks/useAuction";

export default function Home() {
  const { formattedTime } = useAuction({ startingTime: 15 });

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
          <Link
            href="/auction/aurora"
            className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
          >
            Enter Auction
            <ArrowUpRight className="h-4 w-4" />
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300">
            <Timer className="h-4 w-4 text-amber-300" />
            {formattedTime}
          </div>
        </div>
      </section>
    </div>
  );
}
