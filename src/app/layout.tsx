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
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-bg-primary antialiased">
        <nav className="bg-bg-secondary border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-50" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <a href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold text-text-primary tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Company Analyzer</span>
          </a>
          <div className="flex items-center gap-5">
            <a href="/library" className="text-sm font-medium text-text-muted hover:text-text-primary transition-colors">Library</a>
            <a href="/" className="text-sm font-medium text-text-muted hover:text-text-primary transition-colors">+ New</a>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
