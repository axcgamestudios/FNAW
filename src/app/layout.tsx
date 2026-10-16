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
  title: "FNAF 2 Reimaginado — Survival Horror 3D",
  description:
    "Survival horror 3D en primera persona inspirado en Five Nights at Freddy's 2. Explora la Pizzería Estelar Bruno, sobrevive cinco noches a animatrónicos con IA, repara sistemas y descubre qué pasó en 1987.",
  keywords: ["survival horror", "FNAF", "Three.js", "juego 3D", "terror", "animatrónicos"],
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
