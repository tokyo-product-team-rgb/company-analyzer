import { NextResponse } from 'next/server';
import { getIndex } from '@/lib/storage';

export async function GET() {
  // Return the index directly — status syncing is handled by the
  // individual analysis GET endpoint (stale detection) and the
  // process endpoint (final save updates index).
  // This avoids N+1 blob fetches that made the library page slow.
  const index = await getIndex();
  return NextResponse.json(index, {
    headers: { 'Cache-Control': 's-maxage=5, stale-while-revalidate=30' },
  });
}
