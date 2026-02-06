"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CircleCheck, CircleX, Link2, Loader2, X } from "lucide-react";
import { useYellow } from "../hooks/useYellow";

export function HeaderChannelStatus() {
  const {
    hasWallet,
    isConnected,
    channelId,
    isDetectingChannel,
    openChannel,
    authStep,
    authError,
    closeChannel,
    isClosing,
    unifiedBalance,
    channelBalance,
    deposit,
    isRefreshingBalances,
    refreshBalances,
  } = useYellow();
  const [isOpening, setIsOpening] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("5");
  const [isToppingUp, setIsToppingUp] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  const handleTopUp = async () => {
    if (isToppingUp) return;
    const parsed = Number(topUpAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setIsToppingUp(true);
    try {
      await deposit(parsed);
    } catch (error) {
      console.warn("Failed to top up channel", error);
    } finally {
      setIsToppingUp(false);
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

  const authCopy = useMemo(() => {
    switch (authStep) {
      case "request":
        return {
          title: "Connecting to Yellow",
          body: "Preparing the Yellow Network session. Keep your wallet ready.",
        };
      case "challenge":
        return {
          title: "Authorize Yellow Session",
          body: "Sign the Yellow Network authentication request in your wallet to continue.",
        };
      case "verify":
        return {
          title: "Verifying Signature",
          body: "Finalizing your session with Yellow Network.",
        };
      case "success":
        return {
          title: "Session Ready",
          body: "You are connected to the Yellow Network.",
        };
      case "error":
        return {
          title: "Authorization Failed",
          body: authError ?? "We couldn't authenticate your Yellow session.",
        };
      default:
        return null;
    }
  }, [authStep, authError]);

  return (
    <>
      <div className="hidden items-center gap-3 md:flex">
        <button
          type="button"
          onClick={() => setIsManageOpen(true)}
          className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-zinc-200 transition hover:border-amber-300/40 hover:text-amber-200"
        >
          <span className={`h-2 w-2 rounded-full ${dotClass}`} />
          {status.label}
        </button>
      </div>

      {isMounted &&
        createPortal(
          <>
            <AnimatePresence>
              {authCopy && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
                >
                  <motion.div
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 12, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/95 p-6 text-white shadow-2xl"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.3em] text-amber-300">
                          Yellow Network
                        </p>
                        <h2 className="text-xl font-semibold">{authCopy.title}</h2>
                      </div>
                      {authStep === "success" ? (
                        <CircleCheck className="h-6 w-6 text-emerald-300" />
                      ) : authStep === "error" ? (
                        <CircleX className="h-6 w-6 text-rose-300" />
                      ) : (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
                      )}
                    </div>
                    <p className="mt-4 text-sm text-zinc-300">{authCopy.body}</p>
                    {authStep === "error" && (
                      <p className="mt-3 text-xs text-rose-300">{authError}</p>
                    )}
                    <div className="mt-6 flex items-center gap-3 text-xs text-zinc-400">
                      <span className="h-2 w-2 rounded-full bg-amber-300" />
                      Awaiting wallet confirmation.
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isManageOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
                >
                  <motion.div
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 12, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950/95 p-6 text-white shadow-2xl"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-amber-300">
                          Session Manager
                        </p>
                        <h2 className="mt-2 text-xl font-semibold">
                          Yellow Network Session
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsManageOpen(false)}
                        className="rounded-full border border-white/10 p-2 text-zinc-300 transition hover:border-white/30 hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-zinc-300">
                      <div className="flex items-center justify-between">
                        <span>Channel status</span>
                        <span className="text-white">
                          {isConnected ? "Connected" : "Not connected"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Channel ID</span>
                        <span className="font-mono text-xs text-amber-200">
                          {channelId ?? "Not created"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-slate-950/80 p-4 text-sm text-zinc-300 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                          Unified Balance
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          ${unifiedBalance.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                          Channel Balance
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          ${channelBalance.toFixed(2)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={refreshBalances}
                        disabled={isRefreshingBalances}
                        className="col-span-full inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-200 transition hover:border-amber-300/40 hover:text-amber-200 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-zinc-500"
                      >
                        {isRefreshingBalances ? "Refreshing..." : "Refresh Balances"}
                      </button>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                        Top up channel
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={topUpAmount}
                          onChange={(event) => setTopUpAmount(event.target.value)}
                          className="w-28 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-300/60"
                        />
                        <button
                          type="button"
                          onClick={handleTopUp}
                          disabled={!channelId || isToppingUp}
                          className="inline-flex items-center gap-2 rounded-2xl bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-amber-400/40"
                        >
                          {isToppingUp ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Topping Up
                            </>
                          ) : (
                            <>
                              <Link2 className="h-4 w-4" />
                              Top Up
                            </>
                          )}
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-zinc-500">
                        Uses unified balance to fund the active channel.
                      </p>
                    </div>

                    <p className="mt-4 text-xs text-zinc-400">
                      Closing the session will submit the latest state to the chain and
                      disconnect this channel from Yellow.
                    </p>

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                      {!channelId ? (
                        <button
                          type="button"
                          onClick={handleOpenChannel}
                          disabled={isOpening || isDetectingChannel || !hasWallet}
                          className="inline-flex items-center gap-2 rounded-2xl bg-amber-400 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-amber-400/40"
                        >
                          {isOpening ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Opening
                            </>
                          ) : (
                            <>
                              <Link2 className="h-4 w-4" />
                              {hasWallet ? "Open Channel" : "Connect Wallet"}
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            if (isClosing || !channelId) return;
                            await closeChannel();
                            setIsManageOpen(false);
                          }}
                          disabled={!channelId || isClosing}
                          className="rounded-2xl bg-rose-500/90 px-5 py-2 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:bg-rose-500/40"
                        >
                          {isClosing ? "Closing Session..." : "Close Session"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsManageOpen(false)}
                        className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:border-white/30 hover:text-white"
                      >
                        Done
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </>,
          document.body
        )}
    </>
  );
}
