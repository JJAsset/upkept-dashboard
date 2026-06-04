import type { Metadata } from "next";
import "./tokens.css";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Upkept Metrics",
  description: "Operational metrics dashboard for Upkept Assets",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="appShell">
          <Sidebar />
          <main className="mainArea">{children}</main>
        </div>
      </body>
    </html>
  );
}
