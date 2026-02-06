"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ArrowUpRight } from "lucide-react";
import { useYellow } from "./hooks/useYellow";

export default function Home() {
  const { hasWallet } = useYellow();

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
                  {!connected && (
                    <button
                      type="button"
                      onClick={openConnectModal}
                      className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
                    >
                      Connect Wallet
                    </button>
                  )}
                  {connected && (
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
          <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-300">
            <span className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2">
              {!hasWallet
                ? "Connect wallet to continue."
                : "Create your auction session after you enter."}
            </span>
          </div>
        </div>
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
