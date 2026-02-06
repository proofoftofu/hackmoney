import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { YellowProvider } from "./providers/YellowProvider";
import { Web3Provider } from "./providers/Web3Provider";
import { WalletButton } from "./components/WalletButton";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Yellow Network | Penny Auction dApp",
  description:
    "Penny Auction MVP with state channel bidding and real-time countdowns.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${plexMono.variable} min-h-screen bg-slate-950 text-zinc-100 antialiased`}
      >
        <Web3Provider>
          <YellowProvider>
            <div className="relative min-h-screen overflow-hidden">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.12),_transparent_55%),radial-gradient(circle_at_30%_30%,_rgba(56,189,248,0.08),_transparent_50%)]" />
              <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:40px_40px]" />

              <header className="relative z-10 border-b border-white/10 bg-slate-950/70 backdrop-blur">
                <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
                  <Link href="/" className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-amber-300 to-yellow-200 text-slate-950 shadow-lg shadow-amber-500/30">
                      Y
                    </div>
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-amber-300">
                      Yellow Network
                    </p>
                    <p className="text-xl font-semibold text-white">Penny Auction</p>
                  </div>
                  </Link>
                  <div className="flex items-center gap-3">
                    <WalletButton />
                  </div>
                </div>
              </header>

              <main className="relative z-10 mx-auto w-full max-w-6xl px-6 py-10">
                {children}
              </main>
            </div>
          </YellowProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
