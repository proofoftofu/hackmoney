"use client";

import { useMemo, useState } from "react";
import { Link2, Link2Off, Loader2 } from "lucide-react";
import { useYellow } from "../hooks/useYellow";

export function HeaderChannelStatus() {
  const { hasWallet, isConnected, channelId, isDetectingChannel, openChannel } =
    useYellow();
  const [isOpening, setIsOpening] = useState(false);

  const status = useMemo(() => {
    if (!hasWallet) {
      return { label: "Wallet: Disconnected", tone: "muted" as const };
    }
    if (isDetectingChannel) {
      return { label: "Channel: Checking", tone: "busy" as const };
    }
    if (channelId) {
      return {
        label: isConnected ? "Channel: Live" : "Channel: Reconnecting",
        tone: isConnected ? ("live" as const) : ("busy" as const),
      };
    }
    return { label: "Channel: Closed", tone: "warn" as const };
  }, [hasWallet, isDetectingChannel, channelId, isConnected]);

  const handleOpenChannel = async () => {
    if (isOpening || isDetectingChannel) return;
    setIsOpening(true);
    try {
      await openChannel();
    } catch (error) {
      console.warn("Failed to open channel", error);
    } finally {
      setIsOpening(false);
    }
  };

  const dotClass =
    status.tone === "live"
      ? "bg-emerald-400"
      : status.tone === "warn"
        ? "bg-amber-300"
        : status.tone === "busy"
          ? "bg-sky-300 animate-pulse"
          : "bg-white/30";

  return (
    <div className="hidden items-center gap-3 md:flex">
      <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-zinc-200">
        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
        {status.label}
      </div>
      {hasWallet && !channelId ? (
        <button
          type="button"
          onClick={handleOpenChannel}
          disabled={isOpening || isDetectingChannel}
          className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-300/20 disabled:cursor-wait disabled:opacity-60"
        >
          {isOpening ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Opening
            </>
          ) : (
            <>
              <Link2 className="h-3.5 w-3.5" />
              Open Channel
            </>
          )}
        </button>
      ) : (
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-400">
          {channelId ? (
            <>
              <Link2 className="h-3.5 w-3.5 text-emerald-300" />
              Ready
            </>
          ) : (
            <>
              <Link2Off className="h-3.5 w-3.5 text-zinc-400" />
              Awaiting Wallet
            </>
          )}
        </div>
      )}
    </div>
  );
}
