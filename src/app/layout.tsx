import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HELVETIA//FX — CHF · EUR · TND Forex Information & D3.js Rate Monitor",
  description:
    "Public foreign exchange information portal showcasing live rates, D3.js financial charts, currency conversion, and triangular cross-rate analytics exclusively for CHF-EUR, EUR-TND, and CHF-TND.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-sans bg-[#F8FAFC] text-[#0F172A] antialiased selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
