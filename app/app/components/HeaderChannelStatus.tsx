"use client";

import { LogIn, LogOut } from "lucide-react";
import { useYellow } from "../hooks/useYellow";

export function HeaderChannelStatus() {
  const {
    hasWallet,
    isConnected,
    isConnecting,
    connectSession,
    disconnectSession,
  } = useYellow();

  return (
    <div className="hidden items-center gap-3 md:flex">
      {!hasWallet ? null : !isConnected ? (
        <button
          type="button"
          onClick={async () => {
            if (isConnecting || !hasWallet) return;
            await connectSession();
          }}
          disabled={isConnecting || !hasWallet}
          className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-amber-400/40"
        >
          <LogIn className="h-3.5 w-3.5" />
          {isConnecting ? "Signing In..." : "Sign In"}
        </button>
      ) : (
        <button
          type="button"
          onClick={async () => {
            if (isConnecting) return;
            await disconnectSession();
          }}
          disabled={isConnecting}
          className="inline-flex items-center gap-2 rounded-full bg-rose-500/90 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:bg-rose-500/40"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </button>
      )}
    </div>
  );
}
