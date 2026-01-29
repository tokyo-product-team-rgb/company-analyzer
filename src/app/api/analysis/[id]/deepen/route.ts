import { NextRequest, NextResponse } from 'next/server';
import { getAnalysis, saveAnalysis } from '@/lib/storage';
import { runAgent, generateGapQuestions } from '@/lib/ai';
import { enrichCompany } from '@/lib/web-search';
import { AgentRole } from '@/lib/types';

export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const analysis = await getAnalysis(id);
  if (!analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
  }

  const body = await req.json();
  const answers: Record<string, string> = body.answers || {};

  // Record the deepen attempt
  analysis.deepenHistory.push({ answers, timestamp: new Date().toISOString() });
  analysis.status = 'processing';
  await saveAnalysis(analysis);

  // Fire and forget the re-analysis
  deepenAnalysis(id, analysis.companyName, analysis.inputSummary, answers).catch(console.error);

  return NextResponse.json({ status: 'processing' });
}

async function deepenAnalysis(id: string, companyName: string, originalInput: string, answers: Record<string, string>) {
  try {
    const webContext = await enrichCompany(companyName);
    const additionalContext = Object.entries(answers)
      .map(([q, a]) => `Q: ${q}\nA: ${a}`)
      .join('\n\n');

    const companyInfo = `Company: ${companyName}\n\n${originalInput}\n\n## Additional Information Provided:\n${additionalContext}`;

    const roles: AgentRole[] = ['researcher', 'strategist', 'sector', 'financial'];
    const results = await Promise.all(
      roles.map(role => runAgent(role, companyInfo, webContext))
    );

    const otherAnalyses = results
      .filter(r => r.status === 'complete')
      .map(r => `## ${r.emoji} ${r.title}\n${r.content}`)
      .join('\n\n---\n\n');

    const summary = await runAgent('summary', companyInfo, webContext, otherAnalyses);
    results.push(summary);

    const gapQuestions = await generateGapQuestions(companyInfo, otherAnalyses);

    const analysis = await getAnalysis(id);
    if (analysis) {
      analysis.agents = results;
      analysis.gapQuestions = gapQuestions;
      analysis.webEnrichment = webContext;
      analysis.status = 'complete';
      analysis.updatedAt = new Date().toISOString();
      await saveAnalysis(analysis);
    }
  } catch (error) {
    console.error('Deepen error:', error);
    const analysis = await getAnalysis(id);
    if (analysis) {
      analysis.status = 'error';
      await saveAnalysis(analysis);
    }
  }
}
