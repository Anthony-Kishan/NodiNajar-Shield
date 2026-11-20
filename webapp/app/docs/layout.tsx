import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "NodiNajar docs · pitch, architecture and live system",
  description: "NodiNajar in 2 minutes (pitch) and 10 minutes (architecture, data, AI, APIs, security), with numbers read live from the app's data.",
};

export default function DocsLayout({ children }: { children: ReactNode }) {
  return children;
}
