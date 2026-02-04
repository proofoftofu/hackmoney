import Link from "next/link";
import { ArrowUpRight, ShieldCheck, Zap } from "lucide-react";
import { AuctionCard } from "./components/AuctionCard";

const auctions = [
  {
    id: "aurora",
    title: "Aurora Smartwatch",
    retailValue: "$289",
    startingPrice: 0.05,
    accent: "from-amber-500/20 via-amber-400/10 to-transparent",
  },
  {
    id: "zenith",
    title: "Zenith Drone Kit",
    retailValue: "$649",
    startingPrice: 0.08,
    accent: "from-yellow-400/20 via-amber-400/10 to-transparent",
  },
  {
    id: "lumen",
    title: "Lumen VR Headset",
    retailValue: "$399",
    startingPrice: 0.06,
    accent: "from-amber-300/20 via-amber-200/10 to-transparent",
  },
  {
    id: "pulse",
    title: "Pulse Audio Lab",
    retailValue: "$219",
    startingPrice: 0.04,
    accent: "from-yellow-300/20 via-amber-400/10 to-transparent",
  },
];

const stats = [
  {
    label: "Latency",
    value: "95ms",
    detail: "State channel confirmation",
    icon: Zap,
  },
  {
    label: "Bid Security",
    value: "Escrowed",
    detail: "Unified balance locked",
    icon: ShieldCheck,
  },
];

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[32px] border border-white/10 bg-slate-950/80 p-8 shadow-[0_30px_80px_-45px_rgba(250,204,21,0.6)]">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-300">
            Live Penny Auction
          </p>
          <h1 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">
            Bid fast. Win faster.
            <span className="block text-amber-300">State channel speed.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-zinc-400">
            Yellow Network powers lightning bids with unified balances, enabling
            sub-second auctions and instant payouts. Every $0.01 bid keeps the
            clock alive.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link
              href="/auction/aurora"
              className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
            >
              Enter Auction
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="/create"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-amber-400/40 hover:text-amber-200"
            >
              Create Auction
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <div className="grid gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-3xl border border-white/10 bg-black/40 p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                    {stat.label}
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-white">
                    {stat.value}
                  </p>
                  <p className="mt-2 text-sm text-zinc-500">{stat.detail}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300">
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          ))}
          <div className="rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-400/15 via-transparent to-transparent p-6">
            <p className="text-xs uppercase tracking-[0.25em] text-amber-200">
              Live Sessions
            </p>
            <p className="mt-3 text-3xl font-semibold text-white">24</p>
            <p className="mt-2 text-sm text-zinc-400">
              Auctions running with signed app state updates.
            </p>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Active Auctions</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Each bid resets the timer to 15 seconds. Stay sharp.
          </p>
        </div>
        <Link
          href="/profile"
          className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-200 transition hover:border-amber-400/40 hover:text-amber-200 md:inline-flex"
        >
          View Profile
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {auctions.map((auction) => (
          <AuctionCard key={auction.id} {...auction} />
        ))}
      </section>
    </div>
  );
}
