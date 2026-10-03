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
        <header className="bar">
          <div className="frame">
            <a href="/">ClaimState</a>
            <span>Obligation record</span>
          </div>
        </header>
        {children}
        <footer>
          <div className="frame">
            <p>Signed lifecycle evidence. Not a title, a lien, or an assignment.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
