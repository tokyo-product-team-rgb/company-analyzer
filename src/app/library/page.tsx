'use client';

import { useState, useEffect } from 'react';

interface AnalysisEntry {
  id: string;
  companyName: string;
  createdAt: string;
  status: string;
}

export default function LibraryPage() {
  const [analyses, setAnalyses] = useState<AnalysisEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'complete' | 'processing' | 'error'>('all');

  useEffect(() => {
    fetch('/api/analyses')
      .then(r => r.json())
      .then(data => { setAnalyses(data.analyses || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = analyses.filter(a => {
    if (filter !== 'all' && a.status !== filter) return false;
    if (search && !a.companyName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const completeCount = analyses.filter(a => a.status === 'complete').length;
  const processingCount = analyses.filter(a => a.status === 'processing').length;
  const errorCount = analyses.filter(a => a.status === 'error').length;

  const handleDelete = async (id: string) => {
    await fetch(`/api/analysis/${id}`, { method: 'DELETE' });
    setAnalyses(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-primary" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Library
          </h1>
          <p className="text-text-secondary mt-1">
            {analyses.length} {analyses.length === 1 ? 'analysis' : 'analyses'} · {completeCount} complete
          </p>
        </div>
        <a
          href="/"
          className="px-4 py-2 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          + New Analysis
        </a>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search companies..."
            className="w-full bg-white border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'complete', 'processing', 'error'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors capitalize ${
                filter === f
                  ? 'bg-accent/15 border-accent/40 text-accent'
                  : 'bg-bg-secondary border-border text-text-secondary hover:border-border-bright'
              }`}
            >
              {f === 'all' ? `All (${analyses.length})` :
               f === 'complete' ? `Complete (${completeCount})` :
               f === 'processing' ? `In Progress (${processingCount})` :
               `Error (${errorCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-16">
          <svg className="animate-spin h-6 w-6 text-accent mx-auto mb-3" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-text-muted text-sm">Loading library...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 bg-bg-secondary border border-border rounded-xl">
          <div className="text-4xl mb-3">📚</div>
          <h2 className="text-lg font-semibold text-text-primary mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            {search || filter !== 'all' ? 'No matching analyses' : 'Library is empty'}
          </h2>
          <p className="text-text-muted text-sm mb-4">
            {search || filter !== 'all' ? 'Try adjusting your search or filters.' : 'Run your first company analysis to get started.'}
          </p>
          {!search && filter === 'all' && (
            <a href="/" className="text-accent hover:text-accent-hover text-sm font-medium">
              → Start an analysis
            </a>
          )}
        </div>
      )}

      {/* Analysis Cards */}
      {!loading && filtered.length > 0 && (
        <div className="grid gap-4">
          {filtered.map(a => (
            <div
              key={a.id}
              className="bg-bg-secondary border border-border rounded-xl p-5 hover:border-border-bright transition-colors group"
            >
              <div className="flex items-start justify-between">
                <a href={`/analysis/${a.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-text-primary" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                      {a.companyName}
                    </h3>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      a.status === 'complete' ? 'bg-success/15 text-success' :
                      a.status === 'processing' ? 'bg-warning/15 text-warning' :
                      'bg-danger/15 text-danger'
                    }`}>
                      {a.status === 'complete' ? '✓ Complete' :
                       a.status === 'processing' ? '⏳ In Progress' :
                       '✗ Error'}
                    </span>
                  </div>
                  <p className="text-text-muted text-sm mt-1">
                    {new Date(a.createdAt).toLocaleDateString(undefined, { 
                      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </a>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={`/analysis/${a.id}`}
                    className="text-xs px-3 py-1.5 bg-accent/10 text-accent rounded-xl hover:bg-accent/20 font-medium"
                  >
                    View
                  </a>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="text-xs px-3 py-1.5 bg-danger/10 text-danger rounded-xl hover:bg-danger/20 font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
