import type { Metadata, Viewport } from "next";
import "@fontsource/unbounded/cyrillic-ext-500.css";
import "@fontsource/unbounded/cyrillic-ext-600.css";
import "@fontsource/unbounded/latin-500.css";
import "@fontsource/unbounded/latin-600.css";
import "@fontsource/ibm-plex-sans/cyrillic-ext-400.css";
import "@fontsource/ibm-plex-sans/cyrillic-ext-500.css";
import "@fontsource/ibm-plex-sans/cyrillic-ext-600.css";
import "@fontsource/ibm-plex-sans/cyrillic-400.css";
import "@fontsource/ibm-plex-sans/cyrillic-500.css";
import "@fontsource/ibm-plex-sans/cyrillic-600.css";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/ibm-plex-mono/cyrillic-400.css";
import "@fontsource/ibm-plex-mono/cyrillic-500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "INSIDE TECH: технологияның ішіне кір",
  description: "IT технологияларын 3D симуляциялар арқылы зерттеуге, өзгертуге және өз қолыңмен жасауға арналған платформа.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="kk">
      <body>{children}</body>
    </html>
  );
}
