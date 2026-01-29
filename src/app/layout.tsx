import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Company Analyzer",
  description: "Multi-agent company intelligence",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg-primary antialiased">
        <nav className="px-5 py-3.5 flex items-center justify-between sticky top-0 z-50 bg-bg-primary border-b border-border">
          <a href="/" className="text-base font-semibold text-text-primary">
            Company Analyzer
          </a>
          <div className="flex items-center gap-4">
            <a href="/library" className="text-sm text-text-muted hover:text-text-primary transition-colors">Library</a>
            <a href="/" className="text-sm font-medium text-text-primary border border-border rounded-full px-4 py-1.5 hover:bg-bg-tertiary transition-colors">+ New</a>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
