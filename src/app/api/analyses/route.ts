import { NextResponse } from 'next/server';
import { getIndex } from '@/lib/storage';

export async function GET() {
  const index = await getIndex();
  return NextResponse.json(index);
}
