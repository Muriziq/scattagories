import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import { TokenInitializer } from "./accessToken";
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
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        <TokenInitializer />
        {children}
      </body>
    </html>
  );
}
