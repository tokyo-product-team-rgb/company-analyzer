import { NextRequest, NextResponse } from 'next/server';
import { AgentRole } from '@/lib/types';
import { getAnalysis, saveAnalysis } from '@/lib/storage';
import { runAgent, runManagerAgent, generateGapQuestions } from '@/lib/ai';
import { enrichCompany } from '@/lib/web-search';

export const maxDuration = 300;

// Non-fatal intermediate save — skip index updates to reduce blob API calls
async function safeSave(analysis: Parameters<typeof saveAnalysis>[0]) {
  try {
    await saveAnalysis(analysis, false); // false = skip index update
  } catch (e) {
    console.error('Save failed (non-fatal):', e);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const analysis = await getAnalysis(id);
  if (!analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
  }

  if (analysis.status === 'complete') {
    return NextResponse.json({ status: 'complete' });
  }

  // Prevent duplicate processing
  const hasRunning = analysis.agents.some(a => a.status === 'running');
  const hasComplete = analysis.agents.some(a => a.status === 'complete');
  if (hasRunning || hasComplete) {
    // Check for stale processing — if started >8 min ago, allow retry
    const staleThreshold = 8 * 60 * 1000;
    const startedAt = analysis.processStartedAt ? new Date(analysis.processStartedAt).getTime() : 0;
    const isStale = startedAt > 0 && (Date.now() - startedAt > staleThreshold);
    if (!isStale) {
      return NextResponse.json({ status: 'already-processing' });
    }
    // Reset stale agents
    for (const agent of analysis.agents) {
      if (agent.status === 'running') {
        agent.status = 'pending';
        agent.content = '';
      }
    }
  }

  try {
    const inputText = analysis.inputFull || analysis.inputSummary;
    const companyInfo = `Company: ${analysis.companyName}\n\n${inputText}`;

    // Step 1: Web enrichment
    analysis.currentStep = 'Searching the web for company data...';
    analysis.status = 'processing';
    analysis.processStartedAt = new Date().toISOString();
    await safeSave(analysis);

    let webContext = '';
    try {
      webContext = await enrichCompany(analysis.companyName);
    } catch (e) {
      console.error('Web enrichment failed:', e);
      webContext = 'Web search unavailable.';
    }
    analysis.webEnrichment = webContext;

    // Step 2: Run Manager Agent for triage
    analysis.currentStep = 'Manager agent triaging specialists...';
    const managerIdx = analysis.agents.findIndex(a => a.role === 'manager');
    if (managerIdx >= 0) analysis.agents[managerIdx].status = 'running';
    await safeSave(analysis);

    const managerDecision = await runManagerAgent(companyInfo, webContext);
    analysis.managerDecision = managerDecision;

    // Build set of selected roles from manager
    const selectedRoles = new Set(managerDecision.selected.map(s => s.role));
    const skippedMap = new Map(managerDecision.skipped.map(s => [s.role, s.reason]));

    // Mark manager agent as complete
    if (managerIdx >= 0) {
      const selectedCount = managerDecision.selected.length;
      const totalTriaged = selectedCount + managerDecision.skipped.length;
      analysis.agents[managerIdx] = {
        role: 'manager',
        title: 'Manager Agent',
        emoji: '🧠',
        content: `# Agent Triage Decision\n\n**Selected ${selectedCount} of ${totalTriaged} specialist agents** for this company.\n\n## ✅ Selected Agents (${managerDecision.selected.length})\n${managerDecision.selected.map(s => `- **${s.role}**: ${s.reason}`).join('\n')}\n\n## ⏭️ Skipped Agents (${managerDecision.skipped.length})\n${managerDecision.skipped.map(s => `- **${s.role}**: ${s.reason}`).join('\n')}`,
        status: 'complete',
      };
    }

    // Mark skipped agents immediately — ALL 17 specialist agents follow manager's decision
    const allSpecialistRoles: AgentRole[] = ['researcher', 'strategist', 'sector', 'financial', 'aerospace', 'nuclear', 'biology', 'ai_expert', 'mechanical', 'physics', 'legal', 'geopolitical', 'team', 'supply_chain', 'growth', 'cybersecurity', 'fund_fit'];
    for (const role of allSpecialistRoles) {
      if (!selectedRoles.has(role)) {
        const idx = analysis.agents.findIndex(a => a.role === role);
        if (idx >= 0) {
          analysis.agents[idx].status = 'skipped';
          analysis.agents[idx].skippedReason = skippedMap.get(role) || 'Not relevant per manager triage';
          analysis.agents[idx].content = '';
        }
      }
    }

    analysis.currentStep = 'Running expert agents...';
    await safeSave(analysis);

    // Helper to run a batch of selected agents in parallel
    const runBatch = async (roles: AgentRole[], stepLabel: string) => {
      const selected = roles.filter(role => selectedRoles.has(role));
      if (selected.length === 0) return [];

      analysis.currentStep = stepLabel;
      for (const role of selected) {
        const idx = analysis.agents.findIndex(a => a.role === role);
        if (idx >= 0) analysis.agents[idx].status = 'running';
      }
      await safeSave(analysis);

      return Promise.all(
        selected.map(async (role) => {
          const result = await runAgent(role, companyInfo, webContext);
          const idx = analysis.agents.findIndex(a => a.role === role);
          if (idx >= 0) analysis.agents[idx] = result;
          analysis.updatedAt = new Date().toISOString();
          const doneCount = analysis.agents.filter(a => a.status === 'complete' || a.status === 'skipped').length;
          analysis.currentStep = `${doneCount}/${analysis.agents.length} agents complete`;
          await safeSave(analysis);
          return result;
        })
      );
    };

    // Step 3: Run selected business agents in parallel
    const businessRoles: AgentRole[] = ['researcher', 'strategist', 'sector', 'financial'];
    const businessResults = await runBatch(businessRoles, 'Running business expert agents...');

    // Step 4: Run selected science agents in parallel
    const allScienceRoles: AgentRole[] = ['aerospace', 'nuclear', 'biology', 'ai_expert', 'mechanical', 'physics'];
    const scienceResults = await runBatch(allScienceRoles, 'Running science expert agents...');

    // Step 5: Run selected deal agents in parallel
    const allDealRoles: AgentRole[] = ['legal', 'geopolitical', 'team', 'supply_chain', 'growth', 'cybersecurity', 'fund_fit'];
    const dealResults = await runBatch(allDealRoles, 'Running deal analysis agents...');

    // Step 6: Executive summary (synthesizes ALL agents)
    analysis.currentStep = 'Writing executive summary...';
    const summaryIdx = analysis.agents.findIndex(a => a.role === 'summary');
    analysis.agents[summaryIdx].status = 'running';
    await safeSave(analysis);

    const allAgentResults = [...businessResults, ...scienceResults, ...dealResults];
    const otherAnalyses = allAgentResults
      .filter(r => r.status === 'complete')
      .map(r => `## ${r.emoji} ${r.title}\n${r.content}`)
      .join('\n\n---\n\n');

    const summary = await runAgent('summary', companyInfo, webContext, otherAnalyses);
    analysis.agents[summaryIdx] = summary;
    await safeSave(analysis);

    // Step 7: Quality review
    analysis.currentStep = 'Running quality review...';
    const qaIdx = analysis.agents.findIndex(a => a.role === 'qa');
    if (qaIdx >= 0) {
      analysis.agents[qaIdx].status = 'running';
      await safeSave(analysis);

      const allAnalyses = analysis.agents
        .filter(a => a.status === 'complete' && a.role !== 'qa')
        .map(r => `## ${r.emoji} ${r.title}\n${r.content}`)
        .join('\n\n---\n\n');

      const qaResult = await runAgent('qa', companyInfo, webContext, allAnalyses);
      analysis.agents[qaIdx] = qaResult;
      const doneCount = analysis.agents.filter(a => a.status === 'complete').length;
      analysis.currentStep = `${doneCount}/${analysis.agents.length} agents complete`;
      await safeSave(analysis);
    }

    // Step 8: Gap questions
    analysis.currentStep = 'Identifying knowledge gaps...';
    await safeSave(analysis);

    const gapQuestions = await generateGapQuestions(companyInfo, otherAnalyses);
    analysis.gapQuestions = gapQuestions;

    // Check if any agents errored — if most failed, mark overall as error
    const erroredAgents = analysis.agents.filter(a => a.status === 'error');
    const completedAgents = analysis.agents.filter(a => a.status === 'complete' || a.status === 'skipped');

    if (completedAgents.length === 0) {
      // All agents failed — mark as error
      analysis.status = 'error';
      analysis.currentStep = `Analysis failed — all agents encountered errors`;
    } else if (erroredAgents.length > 0) {
      // Some agents failed — still mark complete but could revisit
      analysis.status = 'complete';
      analysis.currentStep = undefined;
    } else {
      analysis.status = 'complete';
      analysis.currentStep = undefined;
    }
    analysis.processStartedAt = undefined;
    analysis.updatedAt = new Date().toISOString();
    // Strip inputFull from blob — no longer needed after processing
    delete analysis.inputFull;
    await saveAnalysis(analysis, true); // true = update index

    return NextResponse.json({ status: 'complete' });
  } catch (error) {
    console.error('Process error:', error);
    analysis.status = 'error';
    analysis.currentStep = 'Analysis failed — ' + (error instanceof Error ? error.message : 'Unknown error');
    try { await saveAnalysis(analysis, true); } catch { /* last resort */ }
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
