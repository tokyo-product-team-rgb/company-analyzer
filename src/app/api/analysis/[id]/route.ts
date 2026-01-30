import { NextRequest, NextResponse } from 'next/server';
import { getAnalysis, deleteAnalysis } from '@/lib/storage';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const analysis = await getAnalysis(id);
  if (!analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
  }

  const headers: Record<string, string> = {};

  if (analysis.status === 'complete') {
    // Completed analyses are immutable (unless deepened, which creates new state).
    // Cache aggressively: 60s on CDN, stale-while-revalidate for 5 min.
    headers['Cache-Control'] = 's-maxage=60, stale-while-revalidate=300';
  } else {
    // Processing/error — don't cache
    headers['Cache-Control'] = 'no-store';
  }

  return NextResponse.json(analysis, { headers });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteAnalysis(id);
  return NextResponse.json({ ok: true });
}
