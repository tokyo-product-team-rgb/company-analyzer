import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { Analysis } from '@/lib/types';
import { saveAnalysis } from '@/lib/storage';

export const maxDuration = 60;

async function extractTextFromUrl(url: string, filename: string): Promise<string> {
  const res = await fetch(url);
  const buffer = Buffer.from(await res.arrayBuffer());
  const lower = filename.toLowerCase();

  if (lower.endsWith('.pdf')) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse');
      const pdfData = await pdfParse(buffer);
      return pdfData.text.slice(0, 50000);
    } catch (e) {
      console.error('PDF parse error:', e);
      return buffer.toString('utf-8').slice(0, 50000);
    }
  }

  return buffer.toString('utf-8').slice(0, 50000);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyName: rawName, text, files } = body as {
      companyName?: string;
      text?: string;
      files?: { url: string; name: string; size: number }[];
    };

    let companyName = rawName || '';
    let inputText = text || '';
    let inputType: 'file' | 'text' | 'name' = 'name';

    // Process uploaded files (blob URLs) — extract text
    if (files && files.length > 0) {
      inputType = 'file';
      const texts = await Promise.all(
        files.map(async (f) => {
          try {
            return await extractTextFromUrl(f.url, f.name);
          } catch (e) {
            console.error(`Failed to extract text from ${f.name}:`, e);
            return `[Could not extract text from ${f.name}]`;
          }
        })
      );
      const fileTexts = texts.map((t, i) => `--- File: ${files[i].name} ---\n${t}`).join('\n\n');
      inputText = inputText ? `${inputText}\n\n${fileTexts}` : fileTexts;
      if (!companyName && files.length > 0) {
        companyName = files[0].name.replace(/\.[^.]+$/, '');
      }
    } else if (inputText) {
      inputType = 'text';
      if (!companyName) {
        companyName = inputText.split('\n')[0].slice(0, 100);
      }
    } else if (companyName) {
      inputType = 'name';
      inputText = `Company name: ${companyName}. Please analyze this company based on your knowledge and any available web research.`;
    }

    if (!companyName && !inputText) {
      return NextResponse.json({ error: 'Please provide a company name, text, or files' }, { status: 400 });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    // Save initial state with all agents pending
    const analysis: Analysis = {
      id,
      companyName,
      inputType,
      inputSummary: inputText.slice(0, 200),
      inputFull: inputText, // store full text for processing endpoint
      createdAt: now,
      updatedAt: now,
      status: 'processing',
      currentStep: 'Queued — starting analysis...',
      agents: [
        { role: 'researcher', title: 'PhD Researcher', emoji: '🎓', content: '', status: 'pending' },
        { role: 'strategist', title: 'McKinsey Strategist', emoji: '📊', content: '', status: 'pending' },
        { role: 'sector', title: 'Sector Expert', emoji: '🏭', content: '', status: 'pending' },
        { role: 'financial', title: 'Financial Analyst', emoji: '💰', content: '', status: 'pending' },
        { role: 'summary', title: 'Executive Summary', emoji: '📋', content: '', status: 'pending' },
      ],
      gapQuestions: [],
      deepenHistory: [],
    };

    await saveAnalysis(analysis);

    // Return ID immediately — frontend will call /api/analysis/[id]/process
    return NextResponse.json({ id, status: 'processing' });
  } catch (error) {
    console.error('Analyze error:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
