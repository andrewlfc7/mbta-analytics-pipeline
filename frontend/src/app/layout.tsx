import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  display: "swap",
  variable: "--font-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "MBTA Transit Intelligence",
  description:
    "Real-time transit analytics and intelligence for the MBTA system",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialAlertCount = 0;
  const initialLastUpdated = "";
  const initialWeatherTemp = "--";
  const initialWeatherCondition = "";

  return (
    <html lang="en">
      <head>
        <link
          href="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css"
          rel="stylesheet"
        />
      </head>
      <body className={`${geistSans.className} bg-[#0F172A] text-slate-100`}>
        <AppShell
          initialAlertCount={initialAlertCount}
          initialLastUpdated={initialLastUpdated}
          initialTemp={initialWeatherTemp}
          initialCondition={initialWeatherCondition}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
