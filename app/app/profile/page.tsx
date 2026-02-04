import { ArrowUpRight, Layers, Lock, Wallet } from "lucide-react";

const sessions = [
  {
    id: "AUC-91F1",
    item: "Aurora Smartwatch",
    status: "Leading",
    bids: 12,
  },
  {
    id: "AUC-22B7",
    item: "Zenith Drone Kit",
    status: "Outbid",
    bids: 8,
  },
  {
    id: "AUC-77L2",
    item: "Lumen VR Headset",
    status: "Watching",
    bids: 3,
  },
];

export default function ProfilePage() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="space-y-6">
        <div className="rounded-[32px] border border-white/10 bg-slate-950/80 p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-300">
            My Profile
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-white">
            Unified balance overview
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Wallet and session stats synced through state channels.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                  Locked Unified Balance
                </p>
                <Lock className="h-4 w-4 text-amber-300" />
              </div>
              <p className="mt-4 text-3xl font-semibold text-white">$32.80</p>
              <p className="mt-2 text-xs text-zinc-500">Across 4 sessions</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                  Available Balance
                </p>
                <Wallet className="h-4 w-4 text-emerald-300" />
              </div>
              <p className="mt-4 text-3xl font-semibold text-white">$18.25</p>
              <p className="mt-2 text-xs text-zinc-500">Ready to deploy</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                Participating Sessions
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                Active Auctions
              </p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-amber-200">
              {sessions.length} sessions
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4"
              >
                <div>
                  <p className="text-sm font-semibold text-white">
                    {session.item}
                  </p>
                  <p className="text-xs text-zinc-500">{session.id}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-200">
                    {session.status}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {session.bids} bids placed
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className="space-y-6">
        <div className="rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-400/15 via-transparent to-transparent p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/40 text-amber-300">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Channel Health</p>
              <p className="text-xs text-zinc-500">All nodes synced</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-zinc-400">
            <div className="flex items-center justify-between">
              <span>Open sessions</span>
              <span className="font-semibold text-white">4</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Signed updates</span>
              <span className="font-semibold text-white">256</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Last settle</span>
              <span className="font-semibold text-white">2 mins ago</span>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
            Next action
          </p>
          <p className="mt-3 text-lg font-semibold text-white">
            Top up unified balance
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            Add funds to instantly join new auctions without on-chain delays.
          </p>
          <button className="mt-5 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-amber-400/40 hover:text-amber-200">
            Deposit Funds
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </aside>
    </div>
  );
}
