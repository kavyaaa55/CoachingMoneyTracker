import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import { getLocale } from "@/lib/locale";
import "./globals.css";

const notoSans = Noto_Sans({
  subsets: ["latin", "devanagari"],
  weight: ["400", "500"],
  variable: "--font-noto-sans",
});

export const metadata: Metadata = {
  title: "Fee Tracker",
  description: "Fees, dues and receipts for parents and accounts staff.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={await getLocale()} className={notoSans.variable}>
      <body>{children}</body>
    </html>
  );
}
