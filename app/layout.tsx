import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GooeyToaster } from "@/components/ui/goey-toaster";
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
  title: "rzp Store & Merchant OS",
  description: "A clean, modern e-commerce storefront powered by Razorpay.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col bg-background text-foreground font-sans"
        suppressHydrationWarning
      >
        {children}
        <GooeyToaster position="bottom-right" />
      </body>
    </html>
  );
}
