'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface AnalysisEntry {
  id: string;
  companyName: string;
  createdAt: string;
  status: string;
}

export default function Home() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analyses, setAnalyses] = useState<AnalysisEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/analyses')
      .then(r => r.json())
      .then(data => setAnalyses(data.analyses || []))
      .catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!companyName && !text && !file) {
      setError('Please provide a company name, paste text, or upload a file');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      if (companyName) formData.append('companyName', companyName);
      if (text) formData.append('text', text);
      if (file) formData.append('file', file);

      const res = await fetch('/api/analyze', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Analysis failed');

      router.push(`/analysis/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setLoading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-accent to-purple-400 bg-clip-text text-transparent">
          Company Analyzer
        </h1>
        <p className="text-text-secondary text-lg max-w-2xl mx-auto">
          Multi-agent AI analysis powered by specialized experts — PhD Researcher, McKinsey Strategist, Sector Expert, and Financial Analyst.
        </p>
      </div>

      {/* Input Card */}
      <div className="bg-bg-secondary border border-border rounded-xl p-8 mb-8">
        {/* Company Name */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-text-secondary mb-2">Company Name</label>
          <input
            type="text"
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            placeholder="e.g., Stripe, Toyota, SpaceX..."
            className="w-full bg-bg-primary border border-border rounded-lg px-4 py-3 text-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-text-muted text-sm">and / or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Text Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-text-secondary mb-2">Paste Company Information</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Paste company description, pitch deck text, financial data, or any relevant information..."
            rows={6}
            className="w-full bg-bg-primary border border-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-y font-mono text-sm"
          />
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-text-muted text-sm">and / or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* File Upload */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-accent bg-accent/5' : file ? 'border-success bg-success/5' : 'border-border hover:border-border-bright'
          }`}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.pptx,.csv,.txt,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={e => setFile(e.target.files?.[0] || null)}
          />
          {file ? (
            <div>
              <div className="text-3xl mb-2">📄</div>
              <p className="font-medium text-success">{file.name}</p>
              <p className="text-text-muted text-sm mt-1">{(file.size / 1024).toFixed(1)} KB</p>
              <button
                onClick={e => { e.stopPropagation(); setFile(null); }}
                className="text-sm text-danger mt-2 hover:underline"
              >
                Remove
              </button>
            </div>
          ) : (
            <div>
              <div className="text-3xl mb-2">📁</div>
              <p className="text-text-secondary">Drag & drop a file or <span className="text-accent">browse</span></p>
              <p className="text-text-muted text-sm mt-1">PDF, PPTX, CSV, TXT — up to 10MB</p>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">{error}</div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || (!companyName && !text && !file)}
          className="w-full mt-6 py-4 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-lg rounded-lg transition-all transform hover:scale-[1.01] active:scale-[0.99]"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Launching Analysis Agents...
            </span>
          ) : (
            '🚀 Analyze Company'
          )}
        </button>
      </div>

      {/* Recent Analyses */}
      {analyses.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 text-text-secondary">Recent Analyses</h2>
          <div className="grid gap-3">
            {analyses.map(a => (
              <a
                key={a.id}
                href={`/analysis/${a.id}`}
                className="bg-bg-secondary border border-border rounded-lg p-4 hover:border-border-bright transition-colors flex items-center justify-between"
              >
                <div>
                  <h3 className="font-medium text-text-primary">{a.companyName}</h3>
                  <p className="text-sm text-text-muted">{new Date(a.createdAt).toLocaleString()}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  a.status === 'complete' ? 'bg-success/20 text-success' :
                  a.status === 'processing' ? 'bg-warning/20 text-warning' :
                  'bg-danger/20 text-danger'
                }`}>
                  {a.status}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
