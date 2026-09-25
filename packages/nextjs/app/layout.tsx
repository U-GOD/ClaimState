import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "ClaimState",
  description: "Obligation state envelope and one in-network reservation.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <a href="/demo">Demo</a>
        </header>
        {children}
      </body>
    </html>
  );
}
