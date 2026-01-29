import { NextRequest, NextResponse } from 'next/server';
import { getAnalysis, saveAnalysis } from '@/lib/storage';
import { runAgent, generateGapQuestions } from '@/lib/ai';
import { enrichCompany } from '@/lib/web-search';
import { AgentRole } from '@/lib/types';

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

  return buffer.toString('utf-8').slice(0, 50000);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const analysis = await getAnalysis(id);
  if (!analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
  }

  const body = await req.json();
  const answers: Record<string, string> = body.answers || {};
  const files: Record<string, { url: string; name: string }[]> = body.files || {};

  // Record the deepen attempt
  analysis.deepenHistory.push({ answers, timestamp: new Date().toISOString() });
  analysis.status = 'processing';
  await saveAnalysis(analysis);

  // Fire and forget the re-analysis
  deepenAnalysis(id, analysis.companyName, analysis.inputFull || analysis.inputSummary, answers, files).catch(console.error);

  return NextResponse.json({ status: 'processing' });
}

async function deepenAnalysis(
  id: string,
  companyName: string,
  originalInput: string,
  answers: Record<string, string>,
  files: Record<string, { url: string; name: string }[]>
) {
  try {
    const webContext = await enrichCompany(companyName);

    // Build additional context from text answers
    const textContext = Object.entries(answers)
      .filter(([, a]) => a.trim())
      .map(([q, a]) => `Q: ${q}\nA: ${a}`)
      .join('\n\n');

    // Extract text from uploaded files
    const fileTexts: string[] = [];
    for (const [question, questionFiles] of Object.entries(files)) {
      for (const f of questionFiles) {
        try {
          const text = await extractTextFromUrl(f.url, f.name);
          fileTexts.push(`--- File: ${f.name} (for: ${question}) ---\n${text}`);
        } catch (e) {
          console.error(`Failed to extract text from ${f.name}:`, e);
          fileTexts.push(`[Could not extract text from ${f.name}]`);
        }
      }
    }

    const fileContext = fileTexts.join('\n\n');
    let additionalContext = '';
    if (textContext) additionalContext += `## Text Answers\n${textContext}\n\n`;
    if (fileContext) additionalContext += `## Uploaded Files\n${fileContext}\n\n`;

    const companyInfo = `Company: ${companyName}\n\n${originalInput}\n\n## Additional Information Provided:\n${additionalContext}`;

    // Update status
    const analysisBeforeAgents = await getAnalysis(id);
    if (analysisBeforeAgents) {
      analysisBeforeAgents.currentStep = 'Running expert agents with new context...';
      await saveAnalysis(analysisBeforeAgents);
    }

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

    const analysis = await getAnalysis(id);
    if (analysis) {
      analysis.agents = results;
      analysis.gapQuestions = gapQuestions;
      analysis.webEnrichment = webContext;
      analysis.status = 'complete';
      analysis.currentStep = null;
      analysis.updatedAt = new Date().toISOString();
      await saveAnalysis(analysis);
    }
  } catch (error) {
    console.error('Deepen error:', error);
    const analysis = await getAnalysis(id);
    if (analysis) {
      analysis.status = 'error';
      await saveAnalysis(analysis);
    }
  }
}
