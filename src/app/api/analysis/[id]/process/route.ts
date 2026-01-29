import { NextRequest, NextResponse } from 'next/server';
import { AgentRole } from '@/lib/types';
import { getAnalysis, saveAnalysis } from '@/lib/storage';
import { runAgent, generateGapQuestions } from '@/lib/ai';
import { enrichCompany } from '@/lib/web-search';

export const maxDuration = 300;

// Non-fatal save — log errors but don't crash
async function safeSave(analysis: Parameters<typeof saveAnalysis>[0]) {
  try {
    await saveAnalysis(analysis);
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
    return NextResponse.json({ status: 'already-processing' });
  }

  try {
    const inputText = analysis.inputFull || analysis.inputSummary;
    const companyInfo = `Company: ${analysis.companyName}\n\n${inputText}`;

    // Step 1: Web enrichment
    analysis.currentStep = 'Searching the web for company data...';
    analysis.status = 'processing';
    await safeSave(analysis);

    let webContext = '';
    try {
      webContext = await enrichCompany(analysis.companyName);
    } catch (e) {
      console.error('Web enrichment failed:', e);
      webContext = 'Web search unavailable.';
    }
    analysis.webEnrichment = webContext;
    analysis.currentStep = 'Running expert agents...';
    await safeSave(analysis);

    // Step 2: Run 4 specialist agents in parallel
    const roles: AgentRole[] = ['researcher', 'strategist', 'sector', 'financial'];

    for (const role of roles) {
      const idx = analysis.agents.findIndex(a => a.role === role);
      analysis.agents[idx].status = 'running';
    }
    await safeSave(analysis);

    const results = await Promise.all(
      roles.map(async (role) => {
        const result = await runAgent(role, companyInfo, webContext);
        const idx = analysis.agents.findIndex(a => a.role === role);
        analysis.agents[idx] = result;
        analysis.updatedAt = new Date().toISOString();
        const doneCount = analysis.agents.filter(a => a.status === 'complete').length;
        analysis.currentStep = `${doneCount}/5 agents complete`;
        await safeSave(analysis);
        return result;
      })
    );

    // Step 3: Executive summary
    analysis.currentStep = 'Writing executive summary...';
    const summaryIdx = analysis.agents.findIndex(a => a.role === 'summary');
    analysis.agents[summaryIdx].status = 'running';
    await safeSave(analysis);

    const otherAnalyses = results
      .filter(r => r.status === 'complete')
      .map(r => `## ${r.emoji} ${r.title}\n${r.content}`)
      .join('\n\n---\n\n');

    const summary = await runAgent('summary', companyInfo, webContext, otherAnalyses);
    analysis.agents[summaryIdx] = summary;
    await safeSave(analysis);

    // Step 4: Gap questions
    analysis.currentStep = 'Identifying knowledge gaps...';
    await safeSave(analysis);

    const gapQuestions = await generateGapQuestions(companyInfo, otherAnalyses);
    analysis.gapQuestions = gapQuestions;

    // Done!
    analysis.status = 'complete';
    analysis.currentStep = undefined;
    analysis.updatedAt = new Date().toISOString();
    await saveAnalysis(analysis); // Final save — use real save, not safe

    return NextResponse.json({ status: 'complete' });
  } catch (error) {
    console.error('Process error:', error);
    analysis.status = 'error';
    analysis.currentStep = 'Analysis failed — ' + (error instanceof Error ? error.message : 'Unknown error');
    try { await saveAnalysis(analysis); } catch { /* last resort */ }
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
