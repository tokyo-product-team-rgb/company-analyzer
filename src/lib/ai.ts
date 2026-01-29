import { GoogleGenerativeAI } from '@google/generative-ai';
import { AgentRole, AgentAnalysis, GapQuestion } from './types';
import { AGENT_CONFIG, getGapAnalysisPrompt } from './agents';

function getClient(): GoogleGenerativeAI | null {
  const key = process.env.GEMINI_API_KEY;
  console.log('GEMINI_API_KEY present:', !!key, 'length:', key?.length || 0);
  if (!key || key.trim().length === 0) return null;
  return new GoogleGenerativeAI(key.trim());
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const client = getClient();
  if (!client) {
    return `⚠️ **AI Analysis Unavailable**\n\nNo GEMINI_API_KEY configured. Add it to your Vercel environment variables to enable AI-powered analysis.\n\nTo set up:\n1. Get an API key from [aistudio.google.com](https://aistudio.google.com/apikey)\n2. Add \`GEMINI_API_KEY\` to your Vercel project environment variables\n3. Redeploy\n\n---\n*This is a placeholder. Real analysis will include detailed, multi-section expert output.*`;
  }

  const model = client.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent(userPrompt);
  return result.response.text();
}

export async function runAgent(role: AgentRole, companyInfo: string, webContext: string, otherAnalyses?: string): Promise<AgentAnalysis> {
  const config = AGENT_CONFIG[role];

  let userPrompt = `## Company Information\n${companyInfo}\n\n## Web Research Context\n${webContext}`;
  if (role === 'summary' && otherAnalyses) {
    userPrompt += `\n\n## Other Agent Analyses\n${otherAnalyses}`;
  }

  try {
    const content = await callGemini(config.systemPrompt, userPrompt);
    return {
      role,
      title: config.title,
      emoji: config.emoji,
      content,
      status: 'complete',
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return {
      role,
      title: config.title,
      emoji: config.emoji,
      content: '',
      status: 'error',
      error: msg,
    };
  }
}

export async function generateGapQuestions(companyInfo: string, analyses: string): Promise<GapQuestion[]> {
  try {
    const raw = await callGemini(
      getGapAnalysisPrompt(),
      `Company info:\n${companyInfo}\n\nAnalyses so far:\n${analyses}`
    );

    // Extract JSON from response
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]);
  } catch {
    return [
      { id: 'gap_1', question: 'What is the company\'s annual revenue?', category: 'Financial Data', priority: 'high' },
      { id: 'gap_2', question: 'Who are the top 3 competitors?', category: 'Competitive Intelligence', priority: 'high' },
      { id: 'gap_3', question: 'What is the company\'s primary customer segment?', category: 'Customer Data', priority: 'medium' },
      { id: 'gap_4', question: 'How many employees does the company have?', category: 'Team & Operations', priority: 'medium' },
      { id: 'gap_5', question: 'What is the company\'s growth rate?', category: 'Financial Data', priority: 'high' },
    ];
  }
}
