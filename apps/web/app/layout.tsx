import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LiveSpeak | 100% On-Device Live Speech-to-Text & Diarization",
  description: "Sub-second live dictation, meeting target lock, zero-latency source-aware speaker diarization, and LAN event broadcasting.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#09090b] text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
