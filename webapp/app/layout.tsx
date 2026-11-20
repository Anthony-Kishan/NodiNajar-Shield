import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import Shell from "@/components/Shell";
import { DataProvider } from "@/lib/data";

export const metadata: Metadata = {
  title: "NodiNajar · Riverbank early warning",
  description: "NISAR radar sees the Jamuna's banks through monsoon cloud. NodiNajar measures where the bank moves, forecasts the next stretches with a back-tested ML model and a daily river outlook, counts the people in the way and plans where crews protect the most lives.",
  icons: { icon: "/favicon.svg" },
};
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap", axes: ["opsz", "SOFT"] });
const body = Manrope({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const viewport: Viewport = { themeColor: "#f3efe6", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <DataProvider>
          <Shell>{children}</Shell>
        </DataProvider>
      </body>
    </html>
  );
}
