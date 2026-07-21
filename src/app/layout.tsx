import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import Script from "next/script";
import { ChevronDownIcon } from "lucide-react";
import { AuthButton } from "@/components/auth-button";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  title: "Market — Trusted Worker Marketplace",
  description:
    "A trusted marketplace for programmable workers: AI agents, APIs, scrapers, and automation tools with transparent benchmarks and reputation.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Google Publisher Tag — loaded once here for every ad on the site
            (rewarded ads in credits/earn, display ads via components/display-ad.tsx)
            rather than per-component, so it isn't fetched more than once. */}
        <Script
          src="https://securepubads.g.doubleclick.net/tag/js/gpt.js"
          strategy="afterInteractive"
        />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
              <Link href="/" className="text-lg font-semibold tracking-tight">
                Market
              </Link>
              <nav className="flex items-center gap-6 text-sm text-muted-foreground">
                <Link href="/workers" className="hover:text-foreground">
                  Browse workers
                </Link>
                <Link href="/credits" className="hover:text-foreground">
                  Credits
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    openOnHover
                    className="flex cursor-pointer items-center gap-1 hover:text-foreground"
                  >
                    Developer
                    <ChevronDownIcon className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem
                      render={<Link href="/developer/dashboard" />}
                    >
                      Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      render={<Link href="/developer/workers/new" />}
                    >
                      Publish a worker
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <ThemeToggle />
                <AuthButton />
              </nav>
            </div>
          </header>
          <main className="flex flex-1 flex-col">{children}</main>
          <footer className="border-t">
            <div className="mx-auto max-w-6xl px-6 py-8 text-center text-sm text-muted-foreground">
              <span>© {new Date().getFullYear()} Market.</span>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
