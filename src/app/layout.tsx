import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { AuthButton } from "@/components/auth-button";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
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
                <Link href="/developer/dashboard" className="hover:text-foreground">
                  Developer
                </Link>
                <Link
                  href="/developer/workers/new"
                  className="hover:text-foreground"
                >
                  Publish a worker
                </Link>
                <ThemeToggle />
                <AuthButton />
              </nav>
            </div>
          </header>
          <main className="flex flex-1 flex-col">{children}</main>
          <footer className="border-t">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>© {new Date().getFullYear()} Market.</span>
              <div className="flex gap-6">
                <Link href="/workers" className="hover:text-foreground">
                  Browse workers
                </Link>
                <Link
                  href="/developer/workers/new"
                  className="hover:text-foreground"
                >
                  Publish a worker
                </Link>
              </div>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
