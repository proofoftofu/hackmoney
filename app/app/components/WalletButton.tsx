"use client";

import React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openConnectModal, openAccountModal }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div className={ready ? "" : "pointer-events-none opacity-0"}>
            {!connected ? (
              <button
                type="button"
                onClick={openConnectModal}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-amber-300"
              >
                Connect Wallet
              </button>
            ) : (
              <button
                type="button"
                onClick={openAccountModal}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-100 transition hover:border-amber-300/40 hover:text-amber-200"
              >
                {account.displayName}
              </button>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
