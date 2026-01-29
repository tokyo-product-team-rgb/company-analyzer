import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Company Analyzer — Multi-Agent Intelligence",
  description: "Deep company analysis powered by specialized AI agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-bg-primary antialiased">
        <nav className="px-6 py-5 flex items-center justify-between sticky top-0 z-50 bg-bg-primary/90 backdrop-blur-sm">
          <a href="/" className="flex items-center gap-2">
            <span className="text-xs tracking-[0.2em] uppercase text-text-muted" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 300 }}>Company Analyzer</span>
          </a>
          <div className="flex items-center gap-6" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 300 }}>
            <a href="/library" className="text-xs tracking-[0.15em] uppercase text-text-muted hover:text-text-primary transition-colors">Library</a>
            <a href="/" className="text-xs tracking-[0.15em] uppercase text-text-muted hover:text-text-primary transition-colors">+ New</a>
          </div>
        </nav>
        <div className="h-px bg-border" />
        <main>{children}</main>
      </body>
    </html>
  );
}
