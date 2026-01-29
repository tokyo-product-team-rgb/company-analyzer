'use client';

import { useState, useEffect } from 'react';

interface AnalysisEntry {
  id: string;
  companyName: string;
  createdAt: string;
  status: string;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getColor(name: string): string {
  const colors = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#6366f1'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function LibraryPage() {
  const [analyses, setAnalyses] = useState<AnalysisEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'complete' | 'processing' | 'error'>('all');

  useEffect(() => {
    fetch('/api/analyses')
      .then(r => r.json())
      .then(data => { setAnalyses(data.analyses || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = analyses.filter(a => {
    if (activeTab === 'all') return true;
    return a.status === activeTab;
  });

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    await fetch(`/api/analysis/${id}`, { method: 'DELETE' });
    setAnalyses(prev => prev.filter(a => a.id !== id));
  };

  const tabs = [
    { key: 'all' as const, label: 'All' },
    { key: 'complete' as const, label: 'Complete' },
    { key: 'processing' as const, label: 'In Progress' },
    { key: 'error' as const, label: 'Error' },
  ];

  return (
    <div className="max-w-lg mx-auto px-5 py-6">
      {/* Tabs */}
      <div className="flex gap-6 mb-6 border-b border-border">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-3 text-sm font-medium transition-colors relative ${
              activeTab === tab.key
                ? 'text-text-primary'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-text-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="py-16 text-center">
          <div className="w-8 h-8 border-2 border-border border-t-text-primary rounded-full animate-spin mx-auto mb-3" />
          <p className="text-text-muted text-sm">Loading...</p>
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-text-muted text-sm mb-3">No analyses found</p>
          <a href="/" className="text-sm font-medium text-text-primary">+ New Analysis</a>
        </div>
      )}

      {/* Company List */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map(a => (
            <a
              key={a.id}
              href={`/analysis/${a.id}`}
              className="flex items-center gap-4 p-4 rounded-2xl bg-bg-tertiary hover:bg-border/50 transition-colors group"
            >
              {/* Logo placeholder */}
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold"
                style={{ backgroundColor: getColor(a.companyName) }}
              >
                {getInitials(a.companyName)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-text-primary truncate">{a.companyName}</h3>
                <p className="text-sm text-text-muted">
                  {a.status === 'complete' ? 'Complete' :
                   a.status === 'processing' ? 'In Progress' :
                   'Error'}
                </p>
              </div>

              {/* Delete — visible on hover */}
              <button
                onClick={(e) => handleDelete(e, a.id)}
                className="text-text-muted hover:text-danger text-xs opacity-0 group-hover:opacity-100 transition-opacity p-2"
              >
                ✕
              </button>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
