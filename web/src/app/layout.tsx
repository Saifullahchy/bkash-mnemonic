import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { BRAND } from "@/lib/constants";
import { env } from "@/lib/env";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { StoreProvider } from "@/store/StoreProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    default: `${BRAND.name} — Share Offers, Win Prizes`,
    template: `%s | ${BRAND.name}`,
  },
  description: "Pick an offer, share it with your friends, and win prizes.",
};

export const viewport: Viewport = {
  themeColor: "#e2136e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: browser extensions (Grammarly, translators…) add
    // attributes to <html>/<body> before React loads, and SmoothScroll adds classes
    // to <html>. This only ignores attribute differences on these two tags; real
    // mismatches inside the page are still reported.
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      {/* Phones/small tablets: a centered phone-width column. Desktop (md+): full width; each section is limited to --page-width. */}
      <body className="min-h-dvh bg-white font-sans" suppressHydrationWarning>
        <div className="bg-surface relative mx-auto flex min-h-dvh w-full max-w-[448px] flex-col shadow-[0_0_40px_-12px_rgb(0_0_0/0.15)] md:max-w-none md:shadow-none">
          <StoreProvider>
            <SmoothScroll>{children}</SmoothScroll>
          </StoreProvider>
        </div>
      </body>
    </html>
  );
}
