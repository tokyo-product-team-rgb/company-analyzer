import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { Analysis, AgentRole } from '@/lib/types';
import { saveAnalysis, uploadFile } from '@/lib/storage';
import { runAgent, generateGapQuestions } from '@/lib/ai';
import { enrichCompany } from '@/lib/web-search';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let companyName = '';
    let inputText = '';
    let inputType: 'file' | 'text' | 'name' = 'name';

    if (contentType.includes('multipart/form-data')) {
      let formData: FormData;
      try {
        formData = await req.formData();
      } catch (e) {
        console.error('FormData parse error:', e);
        return NextResponse.json({ error: 'File too large or invalid format. Try a smaller file or paste the text instead.' }, { status: 400 });
      }
      companyName = (formData.get('companyName') as string) || '';
      const text = formData.get('text') as string;
      const file = formData.get('file') as File | null;

      if (file && file.size > 0) {
        inputType = 'file';
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const uploadId = uuidv4();
        await uploadFile(uploadId, file.name, buffer);
        
        // Extract text based on file type
        const fileName = file.name.toLowerCase();
        if (fileName.endsWith('.pdf')) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const pdfParse = require('pdf-parse');
            const pdfData = await pdfParse(buffer);
            inputText = pdfData.text.slice(0, 50000);
          } catch (e) {
            console.error('PDF parse error:', e);
            inputText = buffer.toString('utf-8').slice(0, 50000);
          }
        } else {
          inputText = buffer.toString('utf-8').slice(0, 50000);
        }
        if (!companyName) companyName = file.name.replace(/\.[^.]+$/, '');
      } else if (text) {
        inputType = 'text';
        inputText = text;
        if (!companyName) {
          // Try to extract company name from first line
          companyName = text.split('\n')[0].slice(0, 100);
        }
      } else if (companyName) {
        inputType = 'name';
        inputText = `Company name: ${companyName}. Please analyze this company based on your knowledge and any available web research.`;
      }
    } else {
      const body = await req.json();
      companyName = body.companyName || '';
      inputText = body.text || '';
      inputType = body.inputType || 'text';
      if (!inputText && companyName) {
        inputText = `Company name: ${companyName}. Please analyze this company based on your knowledge and any available web research.`;
      }
    }

    if (!companyName && !inputText) {
      return NextResponse.json({ error: 'Please provide a company name, text, or file' }, { status: 400 });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    // Create initial analysis record
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

    // Return immediately with ID, process in background
    const responsePromise = NextResponse.json({ id, status: 'processing' });

    // Start background processing (fire and forget with waitUntil pattern)
    processAnalysis(id, companyName, inputText).catch(console.error);

    return responsePromise;
  } catch (error) {
    console.error('Analyze error:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}

async function processAnalysis(id: string, companyName: string, inputText: string) {
  try {
    // Enrich with web data
    const webContext = await enrichCompany(companyName);

    const companyInfo = `Company: ${companyName}\n\n${inputText}`;

    // Run first 4 agents in parallel
    const roles: AgentRole[] = ['researcher', 'strategist', 'sector', 'financial'];
    const results = await Promise.all(
      roles.map(role => runAgent(role, companyInfo, webContext))
    );

    // Run summary agent with context from other agents
    const otherAnalyses = results
      .filter(r => r.status === 'complete')
      .map(r => `## ${r.emoji} ${r.title}\n${r.content}`)
      .join('\n\n---\n\n');

    const summary = await runAgent('summary', companyInfo, webContext, otherAnalyses);
    results.push(summary);

    // Generate gap questions
    const gapQuestions = await generateGapQuestions(companyInfo, otherAnalyses);

    // Save completed analysis
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
    // Try to save error state
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
