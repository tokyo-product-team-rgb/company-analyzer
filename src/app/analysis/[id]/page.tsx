'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Analysis, AgentRole } from '@/lib/types';
import AnalysisContent from '@/components/AnalysisContent';
import GapAnalysis from '@/components/GapAnalysis';

const TAB_ORDER: { role: AgentRole; emoji: string; label: string }[] = [
  { role: 'summary', emoji: '📋', label: 'Executive Summary' },
  { role: 'researcher', emoji: '🎓', label: 'PhD Researcher' },
  { role: 'strategist', emoji: '📊', label: 'McKinsey Strategist' },
  { role: 'sector', emoji: '🏭', label: 'Sector Expert' },
  { role: 'financial', emoji: '💰', label: 'Financial Analyst' },
];

export default function AnalysisPage() {
  const params = useParams();
  const id = params.id as string;
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [activeTab, setActiveTab] = useState<AgentRole | 'gaps'>('summary');
  const [error, setError] = useState('');

  const retryCount = useRef(0);
  const processTriggered = useRef(false);

  const fetchAnalysis = useCallback(async () => {
    try {
      const res = await fetch(`/api/analysis/${id}`);
      if (!res.ok) {
        retryCount.current++;
        if (retryCount.current > 20) {
          setError('Analysis not found. It may have failed to start — try again.');
          return 'error';
        }
        return 'processing';
      }
      retryCount.current = 0;
      const data = await res.json();
      setAnalysis(data);

      // Trigger processing if not yet started
      if (data.status === 'processing' && !processTriggered.current) {
        const hasRunning = data.agents?.some((a: { status: string }) => a.status === 'running');
        const hasComplete = data.agents?.some((a: { status: string }) => a.status === 'complete');
        if (!hasRunning && !hasComplete) {
          processTriggered.current = true;
          // Fire and forget — this endpoint runs the full analysis
          fetch(`/api/analysis/${id}/process`, { method: 'POST' }).catch(console.error);
        }
      }

      return data.status;
    } catch {
      retryCount.current++;
      if (retryCount.current > 20) {
        setError('Analysis not found');
        return 'error';
      }
      return 'processing';
    }
  }, [id]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let active = true;
    const poll = async () => {
      if (!active) return;
      const status = await fetchAnalysis();
      if (status === 'processing' && active) {
        interval = setTimeout(poll, 2000);
      }
    };
    poll();
    return () => { active = false; clearTimeout(interval); };
  }, [fetchAnalysis]);

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold mb-2">Analysis Not Found</h1>
        <p className="text-text-secondary mb-6">This analysis doesn&apos;t exist or is still being created.</p>
        <a href="/" className="text-accent hover:text-accent-hover">← Back to Home</a>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="animate-pulse-slow space-y-4">
          <div className="h-8 bg-bg-tertiary rounded w-1/3" />
          <div className="h-4 bg-bg-tertiary rounded w-2/3" />
          <div className="h-64 bg-bg-tertiary rounded" />
        </div>
      </div>
    );
  }

  const isProcessing = analysis.status === 'processing';
  const activeAgent = analysis.agents.find(a => a.role === activeTab);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <a href="/" className="text-text-muted hover:text-text-secondary text-sm">← Back</a>
          {isProcessing && (
            <span className="flex items-center gap-2 text-warning text-sm">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Agents analyzing...
            </span>
          )}
        </div>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{analysis.companyName}</h1>
        <p className="text-text-secondary mt-1">
          {analysis.inputType === 'file' ? '📄 File upload' : analysis.inputType === 'text' ? '📝 Text input' : '🏢 Name only'}
          {' · '}
          {new Date(analysis.createdAt).toLocaleString()}
          {analysis.deepenHistory.length > 0 && ` · Deepened ${analysis.deepenHistory.length}x`}
        </p>
      </div>

      {/* Processing State — Live Progress */}
      {isProcessing && (
        <div className="bg-bg-secondary border border-border rounded-xl p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <svg className="animate-spin h-5 w-5 text-accent" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <h2 className="text-lg font-semibold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              {analysis.currentStep || 'Analysis in progress...'}
            </h2>
          </div>
          <div className="space-y-3">
            {TAB_ORDER.map(tab => {
              const agent = analysis.agents.find(a => a.role === tab.role);
              const status = agent?.status || 'pending';
              return (
                <div key={tab.role} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-white">
                  <span className="text-xl">{tab.emoji}</span>
                  <span className="flex-1 font-medium text-text-primary text-sm">{tab.label}</span>
                  {status === 'complete' && (
                    <span className="flex items-center gap-1 text-success text-sm font-medium">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Done
                    </span>
                  )}
                  {status === 'running' && (
                    <span className="flex items-center gap-2 text-accent text-sm font-medium">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent"></span>
                      </span>
                      Analyzing...
                    </span>
                  )}
                  {status === 'pending' && (
                    <span className="text-text-muted text-sm">Waiting</span>
                  )}
                  {status === 'error' && (
                    <span className="text-danger text-sm font-medium">Failed</span>
                  )}
                </div>
              );
            })}
          </div>
          {/* Progress bar */}
          <div className="mt-6">
            <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500"
                style={{ width: `${(analysis.agents.filter(a => a.status === 'complete').length / 5) * 100}%` }}
              />
            </div>
            <p className="text-text-muted text-xs mt-2 text-right">
              {analysis.agents.filter(a => a.status === 'complete').length} of 5 agents complete
            </p>
          </div>
        </div>
      )}

      {/* Tabs + Content */}
      {analysis.agents.length > 0 && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Tab sidebar */}
          <div className="lg:w-56 flex-shrink-0">
            <div className="lg:sticky lg:top-20 flex lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0">
              {TAB_ORDER.map(tab => {
                const agent = analysis.agents.find(a => a.role === tab.role);
                const isActive = activeTab === tab.role;
                return (
                  <button
                    key={tab.role}
                    onClick={() => setActiveTab(tab.role)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg text-left whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-accent/20 border border-accent/40 text-accent'
                        : 'bg-bg-secondary border border-border hover:border-border-bright text-text-secondary'
                    }`}
                  >
                    <span>{tab.emoji}</span>
                    <span className="text-sm font-medium">{tab.label}</span>
                    {agent?.status === 'complete' && <span className="ml-auto text-success text-xs">✓</span>}
                    {agent?.status === 'error' && <span className="ml-auto text-danger text-xs">✗</span>}
                  </button>
                );
              })}

              {/* Gap Analysis Tab */}
              {analysis.gapQuestions.length > 0 && (
                <button
                  onClick={() => setActiveTab('gaps' as AgentRole)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg text-left whitespace-nowrap transition-colors ${
                    activeTab === ('gaps' as AgentRole)
                      ? 'bg-accent/20 border border-accent/40 text-accent'
                      : 'bg-bg-secondary border border-border hover:border-border-bright text-text-secondary'
                  }`}
                >
                  <span>🔍</span>
                  <span className="text-sm font-medium">Gap Analysis</span>
                  <span className="ml-auto bg-warning/20 text-warning text-xs px-1.5 py-0.5 rounded">
                    {analysis.gapQuestions.length}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 min-w-0">
            <div className="bg-bg-secondary border border-border rounded-xl p-6 md:p-8">
              {activeTab === ('gaps' as AgentRole) ? (
                <GapAnalysis
                  questions={analysis.gapQuestions}
                  analysisId={analysis.id}
                  onDeepen={() => fetchAnalysis()}
                />
              ) : activeAgent ? (
                <div>
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
                    <span className="text-3xl">{activeAgent.emoji}</span>
                    <div>
                      <h2 className="text-xl font-bold">{activeAgent.title}</h2>
                      <p className="text-text-muted text-sm">
                        {activeAgent.status === 'complete' ? 'Analysis complete' : activeAgent.status}
                      </p>
                    </div>
                  </div>
                  <AnalysisContent agent={activeAgent} />
                </div>
              ) : (
                <div className="text-center py-12 text-text-muted">
                  <p>This analysis is not yet available.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
