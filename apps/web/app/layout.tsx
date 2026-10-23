import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Playfair_Display, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SmoothScrollProvider } from "../components/motion/SmoothScrollProvider";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  style: ["italic", "normal"],
  weight: ["400", "600"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "500"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FAF8F4",
};

export const metadata: Metadata = {
  title: "LiveSpeak — On-Device Ultra-Low Latency Speech-to-Text",
  description: "Live speech-to-text that runs 100% on your machine. Sub-second captions, clean grammar, and broadcast to OBS or your audience's phones.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${playfairDisplay.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,600;1,400;1,600&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#FAF8F4] text-on-surface antialiased min-h-screen selection:bg-secondary-container selection:text-primary">
        <SmoothScrollProvider>
          {children}
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
