import { NextResponse } from 'next/server';

export async function GET() {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const braveKey = process.env.BRAVE_API_KEY;
  return NextResponse.json({
    anthropic: anthropicKey ? `set (${anthropicKey.length} chars, starts: ${anthropicKey.substring(0, 8)}...)` : 'NOT SET',
    brave: braveKey ? `set (${braveKey.length} chars)` : 'NOT SET',
    nodeEnv: process.env.NODE_ENV,
  });
}
