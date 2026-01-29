import { NextRequest, NextResponse } from 'next/server';
import { AgentRole } from '@/lib/types';
import { getAnalysis, saveAnalysis } from '@/lib/storage';
import { runAgent, generateGapQuestions } from '@/lib/ai';
import { enrichCompany } from '@/lib/web-search';

export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const analysis = await getAnalysis(id);
  if (!analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
  }

  // Already complete or already being processed by another call
  if (analysis.status === 'complete') {
    return NextResponse.json({ status: 'complete' });
  }

  // Check if any agent is already running (another process call is active)
  const hasRunning = analysis.agents.some(a => a.status === 'running');
  if (hasRunning) {
    return NextResponse.json({ status: 'already-processing' });
  }

  try {
    const inputText = analysis.inputFull || analysis.inputSummary;
    const companyInfo = `Company: ${analysis.companyName}\n\n${inputText}`;

    // Step 1: Web enrichment
    analysis.currentStep = 'Searching the web for company data...';
    await saveAnalysis(analysis);

    const webContext = await enrichCompany(analysis.companyName);
    analysis.webEnrichment = webContext;
    analysis.currentStep = 'Running expert agents...';
    await saveAnalysis(analysis);

    // Step 2: Run 4 specialist agents in parallel
    const roles: AgentRole[] = ['researcher', 'strategist', 'sector', 'financial'];

    // Mark all 4 as running
    for (const role of roles) {
      const idx = analysis.agents.findIndex(a => a.role === role);
      analysis.agents[idx].status = 'running';
    }
    await saveAnalysis(analysis);

    const results = await Promise.all(
      roles.map(async (role) => {
        const result = await runAgent(role, companyInfo, webContext);
        // Save immediately when each completes
        const idx = analysis.agents.findIndex(a => a.role === role);
        analysis.agents[idx] = result;
        analysis.updatedAt = new Date().toISOString();
        const doneCount = analysis.agents.filter(a => a.status === 'complete').length;
        analysis.currentStep = `${doneCount}/5 agents complete`;
        await saveAnalysis(analysis);
        return result;
      })
    );

    // Step 3: Executive summary (needs other agents' output)
    analysis.currentStep = 'Writing executive summary...';
    const summaryIdx = analysis.agents.findIndex(a => a.role === 'summary');
    analysis.agents[summaryIdx].status = 'running';
    await saveAnalysis(analysis);

    const otherAnalyses = results
      .filter(r => r.status === 'complete')
      .map(r => `## ${r.emoji} ${r.title}\n${r.content}`)
      .join('\n\n---\n\n');

    const summary = await runAgent('summary', companyInfo, webContext, otherAnalyses);
    analysis.agents[summaryIdx] = summary;
    await saveAnalysis(analysis);

    // Step 4: Gap questions
    analysis.currentStep = 'Identifying knowledge gaps...';
    await saveAnalysis(analysis);

    const gapQuestions = await generateGapQuestions(companyInfo, otherAnalyses);
    analysis.gapQuestions = gapQuestions;

    // Done!
    analysis.status = 'complete';
    analysis.currentStep = undefined;
    analysis.updatedAt = new Date().toISOString();
    await saveAnalysis(analysis);

    return NextResponse.json({ status: 'complete' });
  } catch (error) {
    console.error('Process error:', error);
    analysis.status = 'error';
    analysis.currentStep = 'Analysis failed — ' + (error instanceof Error ? error.message : 'Unknown error');
    await saveAnalysis(analysis);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
