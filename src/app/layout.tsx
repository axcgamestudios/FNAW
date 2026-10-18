import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FNAF: New World — Complejo Bruno | Survival Horror 3D",
  description:
    "First-person 3D survival horror inspired by FNAF: Security Breach. Explore the Bruno Complex, clear trials with respawns, complete missions and survive the AI-driven animatronics.",
  keywords: ["survival horror", "FNAF", "New World", "Security Breach", "Three.js", "3D game", "horror", "animatronics"],
  authors: [{ name: "Super Z" }],
};

export const viewport: Viewport = {
  themeColor: "#020203",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#020203] overflow-hidden`}>
        {children}
      </body>
    </html>
  );
}
