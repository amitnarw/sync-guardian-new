import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist_Mono, Manrope, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { RefineProvider } from "@/components/refine-provider";

import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-headline",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const manrope = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Sync Guardian Admin",
    template: "%s · Sync Guardian Admin",
  },
  description: "Internal admin panel for Sync Guardian",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${manrope.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Suspense fallback={null}>
          <RefineProvider>{children}</RefineProvider>
        </Suspense>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
