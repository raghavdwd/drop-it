import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ThemeToggle from "@/components/theme-toggle";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/*
 * Metadata is a Next.js convention for setting <head> content.
 * Next.js injects the title, meta description, and favicon link
 * automatically at build/request time (SSR-friendly).
 */
export const metadata: Metadata = {
  title: "Drop It - Zero-server Peer-to-Peer File Sharing",
  description:
    "Drop It is a zero-server peer-to-peer file sharing app built with Next.js and WebRTC. Share files directly between browsers without any servers involved. Simple, fast, secure.",
  icons: {
    icon: "/data-transfer.png",
  },
};

/*
 * RootLayout — wraps every page in the app.
 *
 * The font CSS variable classes are applied to <body> so that all child
 * components can use them via Tailwind's font-sans / font-mono utilities.
 * `antialiased` is a Tailwind class that enables smooth font rendering.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem("theme");
                  if (t === "dark" || (!t && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
                    document.documentElement.classList.add("dark");
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
