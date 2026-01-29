import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Company Analyzer — Multi-Agent Intelligence",
  description: "Deep company analysis powered by specialized AI agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-bg-primary antialiased">
        <nav className="border-b border-border px-6 py-3 flex items-center justify-between bg-bg-secondary/80 backdrop-blur-sm sticky top-0 z-50">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white font-bold text-sm">CA</div>
            <span className="font-semibold text-text-primary">Company Analyzer</span>
          </a>
          <a href="/" className="text-sm text-text-secondary hover:text-text-primary transition-colors">All Analyses</a>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
