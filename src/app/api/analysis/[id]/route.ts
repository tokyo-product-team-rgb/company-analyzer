import { NextRequest, NextResponse } from 'next/server';
import { getAnalysis, deleteAnalysis } from '@/lib/storage';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const analysis = await getAnalysis(id);
  if (!analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
  }
  return NextResponse.json(analysis);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteAnalysis(id);
  return NextResponse.json({ ok: true });
}
