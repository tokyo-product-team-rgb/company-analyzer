'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Analysis, AgentRole } from '@/lib/types';
import AnalysisContent from '@/components/AnalysisContent';
import GapAnalysis from '@/components/GapAnalysis';

const TAB_ORDER: { role: AgentRole; emoji: string; label: string; description: string }[] = [
  { role: 'summary', emoji: '📋', label: 'Executive Summary', description: 'Synthesizing all agent findings into a unified overview' },
  { role: 'researcher', emoji: '🎓', label: 'PhD Researcher', description: 'Conducting academic analysis with citations and methodology' },
  { role: 'strategist', emoji: '📊', label: 'McKinsey Strategist', description: 'Applying Porter\'s Five Forces, SWOT, TAM/SAM frameworks' },
  { role: 'sector', emoji: '🏭', label: 'Sector Expert', description: 'Deep-diving into industry trends, benchmarks, and regulations' },
  { role: 'financial', emoji: '💰', label: 'Financial Analyst', description: 'Evaluating unit economics, margins, and valuation comps' },
];

const PIPELINE_STEPS = [
  { key: 'upload', label: 'Input received', description: 'Company data and files ingested' },
  { key: 'web', label: 'Web research', description: 'Searching news, financial data, competitors, and industry reports' },
  { key: 'agents', label: 'Expert analysis', description: '4 specialist agents analyzing in parallel' },
  { key: 'summary', label: 'Executive summary', description: 'Synthesizing findings from all agents' },
  { key: 'gaps', label: 'Gap analysis', description: 'Identifying what additional information would strengthen the report' },
];

function getPipelineStep(analysis: Analysis): number {
  if (analysis.status === 'complete') return 5;
  const step = analysis.currentStep || '';
  if (step.includes('gap') || step.includes('Gap')) return 4;
  if (step.includes('summary') || step.includes('Summary')) return 3;
  if (step.includes('agent') || step.includes('Agent') || step.includes('/5')) return 2;
  if (step.includes('web') || step.includes('Web') || step.includes('Search')) return 1;
  return 0;
}

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

      if (data.status === 'processing' && !processTriggered.current) {
        const hasRunning = data.agents?.some((a: { status: string }) => a.status === 'running');
        const hasComplete = data.agents?.some((a: { status: string }) => a.status === 'complete');
        if (!hasRunning && !hasComplete) {
          processTriggered.current = true;
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
        <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Analysis Not Found</h1>
        <p className="text-text-secondary mb-6">This analysis doesn&apos;t exist or may have failed to start.</p>
        <a href="/" className="text-accent hover:text-accent-hover font-medium">← Back to Home</a>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <svg className="animate-spin h-8 w-8 text-accent mx-auto mb-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-text-secondary">Loading analysis...</p>
      </div>
    );
  }

  const isProcessing = analysis.status === 'processing';
  const pipelineStep = getPipelineStep(analysis);
  const activeAgent = analysis.agents.find(a => a.role === activeTab);

  // ── PROCESSING VIEW ──
  if (isProcessing) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <a href="/" className="text-text-muted hover:text-text-secondary text-sm">← Back</a>
          <h1 className="text-3xl font-bold mt-3" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{analysis.companyName}</h1>
          <p className="text-text-secondary mt-1 text-sm">
            {analysis.inputType === 'file' ? '📄 File upload' : analysis.inputType === 'text' ? '📝 Text input' : '🏢 Name only'}
            {' · '}Started {new Date(analysis.createdAt).toLocaleTimeString()}
          </p>
        </div>

        {/* Pipeline Steps */}
        <div className="bg-bg-secondary border border-border rounded-xl p-6 md:p-8 mb-6">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-6">Analysis Pipeline</h2>
          <div className="space-y-0">
            {PIPELINE_STEPS.map((step, i) => {
              const isComplete = i < pipelineStep;
              const isCurrent = i === pipelineStep;
              const isPending = i > pipelineStep;
              return (
                <div key={step.key} className="flex gap-4">
                  {/* Vertical line + dot */}
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${
                      isComplete ? 'bg-success border-success text-white' :
                      isCurrent ? 'bg-white border-accent text-accent' :
                      'bg-bg-tertiary border-border text-text-muted'
                    }`}>
                      {isComplete ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      ) : isCurrent ? (
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-accent"></span>
                        </span>
                      ) : (
                        <span className="text-xs font-bold">{i + 1}</span>
                      )}
                    </div>
                    {i < PIPELINE_STEPS.length - 1 && (
                      <div className={`w-0.5 h-8 ${isComplete ? 'bg-success' : 'bg-border'}`} />
                    )}
                  </div>
                  {/* Content */}
                  <div className="pb-6 pt-1">
                    <p className={`font-semibold text-sm ${isCurrent ? 'text-text-primary' : isComplete ? 'text-success' : 'text-text-muted'}`}>
                      {step.label}
                    </p>
                    <p className={`text-xs mt-0.5 ${isCurrent ? 'text-text-secondary' : 'text-text-muted'}`}>
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Agent Status Cards */}
        <div className="bg-bg-secondary border border-border rounded-xl p-6 md:p-8">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">Expert Agents</h2>
          <div className="space-y-3">
            {TAB_ORDER.map(tab => {
              const agent = analysis.agents.find(a => a.role === tab.role);
              const status = agent?.status || 'pending';
              return (
                <div key={tab.role} className={`flex items-start gap-3 px-4 py-3 rounded-lg border transition-colors ${
                  status === 'running' ? 'border-accent/40 bg-white' :
                  status === 'complete' ? 'border-success/30 bg-white' :
                  'border-border bg-white/60'
                }`}>
                  <span className="text-xl mt-0.5">{tab.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${status === 'pending' ? 'text-text-muted' : 'text-text-primary'}`}>
                      {tab.label}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">{tab.description}</p>
                  </div>
                  <div className="flex-shrink-0 mt-0.5">
                    {status === 'complete' && (
                      <span className="flex items-center gap-1 text-success text-xs font-semibold">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        Done
                      </span>
                    )}
                    {status === 'running' && (
                      <span className="flex items-center gap-1.5 text-accent text-xs font-semibold">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                        </span>
                        Working...
                      </span>
                    )}
                    {status === 'pending' && (
                      <span className="text-text-muted text-xs">Queued</span>
                    )}
                    {status === 'error' && (
                      <span className="text-danger text-xs font-semibold">Failed</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="mt-5">
            <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
                style={{ width: `${(analysis.agents.filter(a => a.status === 'complete').length / 5) * 100}%` }}
              />
            </div>
            <p className="text-text-muted text-xs mt-2 text-right">
              {analysis.agents.filter(a => a.status === 'complete').length} of 5 agents complete
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── COMPLETE VIEW ──
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <a href="/" className="text-text-muted hover:text-text-secondary text-sm">← Back</a>
        <h1 className="text-3xl font-bold mt-3" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{analysis.companyName}</h1>
        <p className="text-text-secondary mt-1">
          {analysis.inputType === 'file' ? '📄 File upload' : analysis.inputType === 'text' ? '📝 Text input' : '🏢 Name only'}
          {' · '}
          {new Date(analysis.createdAt).toLocaleString()}
          {analysis.deepenHistory.length > 0 && ` · Deepened ${analysis.deepenHistory.length}x`}
        </p>
      </div>

      {/* Tabs + Content */}
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
                      ? 'bg-accent/15 border border-accent/40 text-accent'
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

            {analysis.gapQuestions.length > 0 && (
              <button
                onClick={() => setActiveTab('gaps' as AgentRole)}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg text-left whitespace-nowrap transition-colors ${
                  activeTab === ('gaps' as AgentRole)
                    ? 'bg-accent/15 border border-accent/40 text-accent'
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
                    <h2 className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{activeAgent.title}</h2>
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
    </div>
  );
}
