'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Analysis, AgentRole } from '@/lib/types';
import AnalysisContent from '@/components/AnalysisContent';
import GapAnalysis from '@/components/GapAnalysis';

const TAB_ORDER: { role: AgentRole; emoji: string; label: string; description: string }[] = [
  { role: 'summary', emoji: '📋', label: 'Executive Summary', description: 'Synthesizing all agent findings into a unified overview' },
  { role: 'researcher', emoji: '🎓', label: 'PhD Polymath', description: 'Multi-disciplinary scientific analysis across all relevant domains' },
  { role: 'strategist', emoji: '📊', label: 'McKinsey Strategist', description: 'Applying Porter\'s Five Forces, SWOT, TAM/SAM frameworks' },
  { role: 'sector', emoji: '🏭', label: 'Sector Expert', description: 'Deep-diving into industry trends, benchmarks, and regulations' },
  { role: 'financial', emoji: '💰', label: 'Financial Analyst', description: 'Evaluating unit economics, margins, and valuation comps' },
  { role: 'aerospace', emoji: '🚀', label: 'Aerospace Engineer', description: 'Evaluating propulsion, aerodynamics, and space/defense tech' },
  { role: 'nuclear', emoji: '⚛️', label: 'Nuclear Engineer', description: 'Evaluating fission/fusion tech, reactor design, and safety' },
  { role: 'biology', emoji: '🧬', label: 'Biologist', description: 'Evaluating biotech, drug pipelines, CRISPR, and clinical trials' },
  { role: 'ai_expert', emoji: '🤖', label: 'AI/ML Scientist', description: 'Evaluating model architectures, data moats, and AI safety' },
  { role: 'mechanical', emoji: '⚙️', label: 'Mechanical Engineer', description: 'Evaluating manufacturing, robotics, and production scalability' },
  { role: 'physics', emoji: '🔬', label: 'Physicist', description: 'Evaluating scientific claims, quantum tech, and physics soundness' },
  { role: 'legal', emoji: '🧑‍⚖️', label: 'Legal Analyst', description: 'Assessing legal risks, IP protection, and regulatory compliance' },
  { role: 'geopolitical', emoji: '🌍', label: 'Geopolitical Analyst', description: 'Evaluating geopolitical risk, sanctions, and supply chain exposure' },
  { role: 'team', emoji: '🧑‍💼', label: 'Team Assessor', description: 'Assessing founder-market fit, team composition, and leadership' },
  { role: 'supply_chain', emoji: '🔗', label: 'Supply Chain', description: 'Evaluating supply chain resilience, vendor risk, and scalability' },
  { role: 'growth', emoji: '📈', label: 'Growth Strategist', description: 'Analyzing GTM strategy, channels, pricing, and growth levers' },
  { role: 'cybersecurity', emoji: '🛡️', label: 'Cybersecurity', description: 'Assessing security posture, compliance, and threat readiness' },
  { role: 'fund_fit', emoji: '🏦', label: 'Fund Fit', description: 'Evaluating deal fit, return profile, and fund construction impact' },
];

const PIPELINE_STEPS = [
  { key: 'upload', label: 'Input received', description: 'Company data and files ingested' },
  { key: 'web', label: 'Web research', description: 'Searching news, financial data, competitors, and industry reports' },
  { key: 'business', label: 'Business analysis', description: '4 business agents analyzing in parallel' },
  { key: 'science', label: 'Science analysis', description: '6 PhD science experts analyzing in parallel' },
  { key: 'deal', label: 'Deal analysis', description: '7 deal experts analyzing in parallel' },
  { key: 'summary', label: 'Executive summary', description: 'Synthesizing findings from all 17 agents' },
  { key: 'qa', label: 'Quality review', description: 'Cross-checking accuracy and consistency' },
  { key: 'gaps', label: 'Gap analysis', description: 'Identifying what additional information would strengthen the report' },
];

function getPipelineStep(analysis: Analysis): number {
  if (analysis.status === 'complete') return 8;
  const step = analysis.currentStep || '';
  if (step.includes('gap') || step.includes('Gap')) return 7;
  if (step.includes('quality') || step.includes('Quality') || step.includes('review')) return 6;
  if (step.includes('summary') || step.includes('Summary')) return 5;
  if (step.includes('deal') || step.includes('Deal')) return 4;
  if (step.includes('science') || step.includes('Science')) return 3;
  const doneCount = analysis.agents.filter(a => a.status === 'complete' || a.status === 'running').length;
  if (step.includes('agent') || step.includes('Agent') || doneCount > 0) {
    const dealRoles = ['legal', 'geopolitical', 'team', 'supply_chain', 'growth', 'cybersecurity', 'fund_fit'];
    const dealActive = analysis.agents.some(a => dealRoles.includes(a.role) && (a.status === 'running' || a.status === 'complete'));
    if (dealActive) return 4;
    const scienceRoles = ['aerospace', 'nuclear', 'biology', 'ai_expert', 'mechanical', 'physics'];
    const scienceActive = analysis.agents.some(a => scienceRoles.includes(a.role) && (a.status === 'running' || a.status === 'complete'));
    return scienceActive ? 3 : 2;
  }
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
          // Only trigger if not recently started by another tab/request
          const processAge = data.processStartedAt
            ? Date.now() - new Date(data.processStartedAt).getTime()
            : Infinity;
          if (processAge > 30_000 || !data.processStartedAt) {
            processTriggered.current = true;
            fetch(`/api/analysis/${id}/process`, { method: 'POST' }).catch(console.error);
          }
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
        <p className="text-text-secondary mb-6">This analysis doesn&apos;t exist or may have failed to start.</p>
        <a href="/" className="text-accent hover:text-accent-hover font-medium">← Back to Home</a>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-16 text-center">
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

  // ── ERROR VIEW ──
  if (analysis.status === 'error') {
    return (
      <div className="max-w-3xl mx-auto px-5 py-8">
        <div className="mb-8">
          <a href="/" className="text-text-muted hover:text-text-secondary text-sm">← Back</a>
          <h1 className="text-3xl font-bold mt-3">{analysis.companyName}</h1>
        </div>
        <div className="bg-bg-secondary border border-danger/30 rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">
            Analysis Failed
          </h2>
          <p className="text-text-secondary text-sm mb-2">
            {analysis.currentStep || 'An error occurred during analysis.'}
          </p>
          <p className="text-text-muted text-xs mb-6">
            This can happen if the AI service is temporarily unavailable. Try submitting again.
          </p>
          <div className="flex items-center justify-center gap-3">
            <a href="/" className="px-4 py-2 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent-hover transition-colors">
              Try Again
            </a>
            <a href="/library" className="px-4 py-2 bg-white text-text-secondary rounded-xl text-sm font-medium hover:text-text-primary transition-colors">
              Library
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── PROCESSING VIEW ──
  if (isProcessing) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-8">
        {/* Header */}
        <div className="mb-8">
          <a href="/" className="text-text-muted hover:text-text-secondary text-sm">← Back</a>
          <h1 className="text-3xl font-bold mt-3">{analysis.companyName}</h1>
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
                      'bg-white border-border text-text-muted'
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
                <div key={tab.role} className={`flex items-start gap-3 px-4 py-3 rounded-xl border transition-colors ${
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
            <div className="h-1.5 bg-white rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
                style={{ width: `${(analysis.agents.filter(a => a.status === 'complete').length / analysis.agents.length) * 100}%` }}
              />
            </div>
            <p className="text-text-muted text-xs mt-2 text-right">
              {analysis.agents.filter(a => a.status === 'complete').length} of {analysis.agents.length} agents complete
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── COMPLETE VIEW ──
  return (
    <div className="max-w-3xl mx-auto px-5 py-8">
      {/* Header */}
      <div className="mb-6">
        <a href="/library" className="text-text-muted hover:text-text-primary text-sm">← Back</a>
        <h1 className="text-2xl font-bold mt-3">{analysis.companyName}</h1>
        <p className="text-text-muted text-sm mt-1">
          {new Date(analysis.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          {analysis.deepenHistory.length > 0 && ` · Deepened ${analysis.deepenHistory.length}x`}
        </p>
      </div>

      {/* Tabs — horizontal pill row */}
      <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto pb-1">
        {TAB_ORDER.map(tab => {
          const isActive = activeTab === tab.role;
          return (
            <button
              key={tab.role}
              onClick={() => setActiveTab(tab.role)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors border ${
                isActive
                  ? 'bg-text-primary text-white border-text-primary'
                  : 'bg-white text-text-secondary border-border hover:border-border-bright'
              }`}
            >
              <span>{tab.emoji}</span>
              <span className="font-medium">{tab.label}</span>
            </button>
          );
        })}

        {analysis.gapQuestions.length > 0 && (
          <button
            onClick={() => setActiveTab('gaps' as AgentRole)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors border ${
              activeTab === ('gaps' as AgentRole)
                ? 'bg-text-primary text-white border-text-primary'
                : 'bg-white text-text-secondary border-border hover:border-border-bright'
            }`}
          >
            <span>🔍</span>
            <span className="font-medium">Gaps ({analysis.gapQuestions.length})</span>
          </button>
        )}
      </div>

      {/* Content area */}
      <div className="flex flex-col gap-6">
        <div>
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
  );
}
