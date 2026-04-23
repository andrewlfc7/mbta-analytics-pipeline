import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MBTA Transit Intelligence",
  description:
    "Real-time transit analytics and intelligence for the MBTA system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.className} bg-[#0F172A] text-slate-100`}>
        <Sidebar />
        <div className="ml-[220px] min-h-screen transition-all duration-300">
          <TopBar />
          <main>
            <div className="mx-auto max-w-[1400px] px-6 py-6">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}