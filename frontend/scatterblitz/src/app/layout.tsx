import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { TokenInitializer } from "./accessToken";
import "./globals.css";

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
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
    <html lang="en" className={inter.className}>
      <body>
        <TokenInitializer />
        {children}
      </body>
    </html>
  );
}
