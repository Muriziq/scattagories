import type { Metadata } from "next";
import { Inter, Fraunces, Bree_Serif } from "next/font/google";
import { TokenInitializer } from "./accessToken";
import CanvasBackground from "./components/CanvasBackground";
import "./globals.css";

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  weight: ['500', '600', '700', '800', '900'],
  variable: '--font-serif',
});

const breeSerif = Bree_Serif({
  subsets: ['latin'],
  display: 'swap',
  weight: '400',
  variable: '--font-bree',
});

export const metadata: Metadata = {
  title: "ScatterBlitz | Fast-Paced Word Battles",
  description: "High-speed multiplayer word game sprints and category battles.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} ${breeSerif.variable}`}>
      <body>
        <TokenInitializer />
        <CanvasBackground />
        {children}
      </body>
    </html>
  );
}
