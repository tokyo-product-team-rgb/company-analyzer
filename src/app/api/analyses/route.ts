import { NextResponse } from 'next/server';
import { getIndex, getAnalysis, saveIndex } from '@/lib/storage';

export async function GET() {
  const index = await getIndex();
  
  // Sync statuses from actual analysis data
  let changed = false;
  for (const entry of index.analyses) {
    const analysis = await getAnalysis(entry.id);
    if (analysis && analysis.status !== entry.status) {
      entry.status = analysis.status;
      changed = true;
    }
  }
  if (changed) {
    await saveIndex(index);
  }
  
  return NextResponse.json(index);
}
