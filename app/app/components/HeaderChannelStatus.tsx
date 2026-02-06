"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CircleCheck, CircleX, Link2, X } from "lucide-react";
import { useYellow } from "../hooks/useYellow";

export function HeaderChannelStatus() {
  const {
    hasWallet,
    isConnected,
    isConnecting,
    sessionAddress,
    connectSession,
    disconnectSession,
    authStep,
    authError,
  } = useYellow();
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const status = useMemo(() => {
    if (!hasWallet) {
      return { label: "Auth: Wallet Missing", tone: "muted" as const };
    }
    if (isConnecting) {
      return { label: "Auth: Signing In", tone: "busy" as const };
    }
    if (isConnected) {
      return { label: "Auth: Signed In", tone: "live" as const };
    }
    return { label: "Auth: Signed Out", tone: "warn" as const };
  }, [hasWallet, isConnecting, isConnected]);

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
          title: "Signing In",
          body: "Preparing authentication with Yellow Network.",
        };
      case "challenge":
        return {
          title: "Authorize Sign-In",
          body: "Sign the Yellow Network authentication request in your wallet to continue.",
        };
      case "verify":
        return {
          title: "Verifying Signature",
          body: "Finalizing your authentication with Yellow Network.",
        };
      case "success":
        return {
          title: "Signed In",
          body: "You are authenticated with Yellow Network.",
        };
      case "error":
        return {
          title: "Sign-In Failed",
          body: authError ?? "We couldn't authenticate your account.",
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
                          Authentication
                        </p>
                        <h2 className="mt-2 text-xl font-semibold">
                          Yellow Network Sign-In
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
                        <span>Sign-in status</span>
                        <span className="text-white">
                          {isConnected ? "Connected" : "Not connected"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Session key</span>
                        <span className="font-mono text-xs text-amber-200">
                          {sessionAddress ?? "Not created"}
                        </span>
                      </div>
                    </div>

                    <p className="mt-4 text-xs text-zinc-400">
                      Sign in once to authenticate. App sessions are used later
                      for bidding and checkout.
                    </p>

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                      {!isConnected ? (
                        <button
                          type="button"
                          onClick={async () => {
                            if (isConnecting || !hasWallet) return;
                            await connectSession();
                          }}
                          disabled={isConnecting || !hasWallet}
                          className="inline-flex items-center gap-2 rounded-2xl bg-amber-400 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-amber-400/40"
                        >
                          <Link2 className="h-4 w-4" />
                          {hasWallet ? "Sign In" : "Connect Wallet"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            if (isConnecting) return;
                            await disconnectSession();
                            setIsManageOpen(false);
                          }}
                          disabled={isConnecting}
                          className="rounded-2xl bg-rose-500/90 px-5 py-2 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:bg-rose-500/40"
                        >
                          Sign Out
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
