import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MBTA Analytics Dashboard",
  description: "Real-time performance analytics for the MBTA transit system",
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
      <body className={inter.className}>
        <Sidebar />
        <main className="ml-60 min-h-screen transition-all duration-300">
          <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
        </main>
      </body>
    </html>
  );
}