import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { Analysis, AgentRole } from '@/lib/types';
import { saveAnalysis } from '@/lib/storage';
import { runAgent, generateGapQuestions } from '@/lib/ai';
import { enrichCompany } from '@/lib/web-search';

export const maxDuration = 300;

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

  // Text-based files
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
    const fileNames: string[] = [];

    // Process uploaded files (blob URLs)
    if (files && files.length > 0) {
      inputType = 'file';
      const extractionPromises = files.map(async (f) => {
        fileNames.push(f.name);
        try {
          return await extractTextFromUrl(f.url, f.name);
        } catch (e) {
          console.error(`Failed to extract text from ${f.name}:`, e);
          return `[Could not extract text from ${f.name}]`;
        }
      });

      const texts = await Promise.all(extractionPromises);
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

    const analysis: Analysis = {
      id,
      companyName,
      inputType,
      inputSummary: inputText.slice(0, 200),
      createdAt: now,
      updatedAt: now,
      status: 'processing',
      agents: [],
      gapQuestions: [],
      deepenHistory: [],
    };

    await saveAnalysis(analysis);

    // Fire and forget background processing
    processAnalysis(id, companyName, inputText).catch(console.error);

    return NextResponse.json({ id, status: 'processing' });
  } catch (error) {
    console.error('Analyze error:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}

async function processAnalysis(id: string, companyName: string, inputText: string) {
  try {
    const webContext = await enrichCompany(companyName);
    const companyInfo = `Company: ${companyName}\n\n${inputText}`;

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

    const analysis: Analysis = {
      id,
      companyName,
      inputType: 'text',
      inputSummary: inputText.slice(0, 200),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'complete',
      agents: results,
      gapQuestions,
      webEnrichment: webContext,
      deepenHistory: [],
    };

    await saveAnalysis(analysis);
  } catch (error) {
    console.error('Background processing error:', error);
    try {
      const analysis: Analysis = {
        id,
        companyName,
        inputType: 'text',
        inputSummary: inputText.slice(0, 200),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'error',
        agents: [],
        gapQuestions: [],
        deepenHistory: [],
      };
      await saveAnalysis(analysis);
    } catch { /* last resort */ }
  }
}
