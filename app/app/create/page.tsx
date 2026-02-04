import { ArrowUpRight, FileText, Sparkles } from "lucide-react";

export default function CreateAuctionPage() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-[32px] border border-white/10 bg-slate-950/80 p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-300">
          Create Auction
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-white">
          List a new penny auction item
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Configure the session parameters and publish to the Yellow Network
          state channel.
        </p>

        <form className="mt-8 grid gap-6">
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              Item Name
            </label>
            <input
              type="text"
              placeholder="Aurora Smartwatch"
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-amber-400/60 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              Retail Value
            </label>
            <input
              type="text"
              placeholder="$289"
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-amber-400/60 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              Starting Bid
            </label>
            <input
              type="text"
              placeholder="$0.05"
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-amber-400/60 focus:outline-none"
            />
          </div>
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-2xl bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
          >
            Publish Auction
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </form>
      </section>

      <aside className="space-y-6">
        <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Listing Preview</p>
              <p className="text-xs text-zinc-500">Auto-generated metadata</p>
            </div>
          </div>
          <div className="mt-6 space-y-3 text-sm text-zinc-400">
            <p>Name: Aurora Smartwatch</p>
            <p>Retail value: $289</p>
            <p>Starting bid: $0.05</p>
            <p>Session timer: 15 seconds</p>
          </div>
        </div>

        <div className="rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-400/10 via-transparent to-transparent p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-amber-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Hackathon Tip</p>
              <p className="text-xs text-zinc-500">Optimize for speed</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-zinc-400">
            Keep auctions under 20 seconds to showcase state channel advantages.
          </p>
        </div>
      </aside>
    </div>
  );
}
