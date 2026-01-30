import { NextRequest, NextResponse } from 'next/server';
import { getAnalysis, saveAnalysis, deleteAnalysis } from '@/lib/storage';

const STALE_THRESHOLD = 8 * 60 * 1000; // 8 minutes

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const analysis = await getAnalysis(id);
  if (!analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
  }

  // Fix mismarked analyses — if status is "complete" but all agents errored, correct it
  if (analysis.status === 'complete') {
    const completedAgents = analysis.agents.filter(a => a.status === 'complete');
    if (completedAgents.length === 0 && analysis.agents.length > 0) {
      analysis.status = 'error';
      analysis.currentStep = 'Analysis failed — all agents encountered errors';
      await saveAnalysis(analysis, true);
    }
  }

  // Detect stale processing — mark as error if stuck too long
  if (analysis.status === 'processing' && analysis.processStartedAt) {
    const elapsed = Date.now() - new Date(analysis.processStartedAt).getTime();
    if (elapsed > STALE_THRESHOLD) {
      analysis.status = 'error';
      analysis.currentStep = 'Analysis timed out. Please try again.';
      analysis.processStartedAt = undefined;
      // Reset any running agents
      for (const agent of analysis.agents) {
        if (agent.status === 'running') {
          agent.status = 'error';
          agent.error = 'Timed out';
        }
      }
      await saveAnalysis(analysis, true);
    }
  }

  const headers: Record<string, string> = {};

  if (analysis.status === 'complete') {
    headers['Cache-Control'] = 's-maxage=60, stale-while-revalidate=300';
  } else {
    headers['Cache-Control'] = 'no-store';
  }

  // Strip inputFull from response to reduce payload (it's only needed for processing)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { inputFull, ...responseData } = analysis;
  return NextResponse.json(responseData, { headers });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteAnalysis(id);
  return NextResponse.json({ ok: true });
}
