import type { ReactNode } from "react";
import "./globals.css";
import { Nav } from "./nav";

export const metadata = {
  title: "ClaimState docs",
  description: "Guides for the ClaimState obligation record on Hedera.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <a className="brand" href="/">
            ClaimState <span>Docs</span>
          </a>
          <nav className="topbar-links" aria-label="Project">
            <a href="/docs/quickstart">Quickstart</a>
            <a href="https://github.com/U-GOD/ClaimState" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </nav>
        </header>
        <div className="frame">
          <Nav />
          {children}
        </div>
      </body>
    </html>
  );
}
