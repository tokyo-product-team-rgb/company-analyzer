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
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-bg-primary antialiased">
        {/* FT-style top accent line */}
        <div className="h-1" style={{ backgroundColor: '#0D7680' }} />
        <nav className="border-b border-border px-6 py-4 flex items-center justify-between bg-bg-secondary sticky top-0 z-50">
          <a href="/" className="flex items-center gap-3">
            <span className="text-xl font-bold text-text-primary tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Company Analyzer</span>
          </a>
          <div className="flex items-center gap-5" style={{ fontFamily: 'var(--font-body)' }}>
            <a href="/library" className="text-sm text-text-secondary hover:text-text-primary transition-colors">Library</a>
            <a href="/" className="text-sm text-text-secondary hover:text-text-primary transition-colors">+ New</a>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
