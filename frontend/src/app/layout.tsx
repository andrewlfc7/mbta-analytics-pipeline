import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { getCurrentWeather, getSystemOverview } from "@/lib/api";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

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
  const [systemOverview, weatherOverview] = await Promise.allSettled([
    getSystemOverview(),
    getCurrentWeather(),
  ]);

  const initialAlertCount =
    systemOverview.status === "fulfilled"
      ? (systemOverview.value?.active_alerts ?? 0)
      : 0;
  const initialLastUpdated =
    systemOverview.status === "fulfilled"
      ? (systemOverview.value?.last_updated ?? "")
      : "";

  const weatherPayload =
    weatherOverview.status === "fulfilled"
      ? weatherOverview.value?.data || weatherOverview.value || {}
      : {};
  const initialWeatherTemp = weatherPayload?.temp_f
    ? `${Math.round(weatherPayload.temp_f)}°F`
    : "--";
  const initialWeatherCondition = weatherPayload?.condition || "";

  return (
    <html lang="en">
      <head>
        <link
          href="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css"
          rel="stylesheet"
        />
      </head>
      <body className={`${geistSans.className} bg-[#0F172A] text-slate-100`}>
        <Sidebar
          initialAlertCount={initialAlertCount}
          initialLastUpdated={initialLastUpdated}
        />
        <div className="ml-[206px] min-h-screen bg-[#0F172A]">
          <TopBar
            initialTemp={initialWeatherTemp}
            initialCondition={initialWeatherCondition}
          />
          <main>
            <div className="mx-auto max-w-[1480px] px-6 py-7">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
