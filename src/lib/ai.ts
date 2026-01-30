import Anthropic from '@anthropic-ai/sdk';
import { AgentRole, AgentAnalysis, GapQuestion, ManagerDecision } from './types';
import { AGENT_CONFIG, getGapAnalysisPrompt } from './agents';

function getClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  console.log('ANTHROPIC_API_KEY present:', !!key, 'length:', key?.length || 0);
  if (!key || key.trim().length === 0) return null;
  return new Anthropic({ apiKey: key.trim() });
}

async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  const client = getClient();
  if (!client) {
    throw new Error('No ANTHROPIC_API_KEY configured. Add it to your Vercel environment variables.');
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userPrompt },
    ],
  });

  const textBlocks = message.content.filter(b => b.type === 'text');
  return textBlocks.map(b => b.text).join('\n');
}

export async function runManagerAgent(companyInfo: string, webContext: string): Promise<ManagerDecision> {
  const config = AGENT_CONFIG['manager'];
  const userPrompt = `## Company Information\n${companyInfo}\n\n## Web Research Context\n${webContext}\n\nAnalyze this company and return JSON selecting which specialist agents to run.`;

  try {
    const raw = await callClaude(config.systemPrompt, userPrompt);
    // Extract JSON from response (handle possible markdown wrapping)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Manager agent returned no JSON, selecting all agents');
      return getDefaultManagerDecision();
    }
    const parsed = JSON.parse(jsonMatch[0]) as ManagerDecision;
    // Validate structure
    if (!Array.isArray(parsed.selected) || !Array.isArray(parsed.skipped)) {
      console.error('Manager agent returned invalid structure, selecting all agents');
      return getDefaultManagerDecision();
    }
    return parsed;
  } catch (error) {
    console.error('Manager agent failed:', error);
    return getDefaultManagerDecision();
  }
}

function getDefaultManagerDecision(): ManagerDecision {
  const allRoles = ['researcher', 'strategist', 'sector', 'financial', 'aerospace', 'nuclear', 'biology', 'ai_expert', 'mechanical', 'physics', 'legal', 'geopolitical', 'team', 'supply_chain', 'growth', 'cybersecurity', 'fund_fit'];
  return {
    selected: allRoles.map(role => ({ role, reason: 'Default — manager agent unavailable' })),
    skipped: [],
  };
}

export async function runAgent(role: AgentRole, companyInfo: string, webContext: string, otherAnalyses?: string): Promise<AgentAnalysis> {
  const config = AGENT_CONFIG[role];

  let userPrompt = `## Company Information\n${companyInfo}\n\n## Web Research Context\n${webContext}`;
  if ((role === 'summary' || role === 'qa') && otherAnalyses) {
    userPrompt += `\n\n## Other Agent Analyses\n${otherAnalyses}`;
  }

  try {
    const content = await callClaude(config.systemPrompt, userPrompt);
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
    const raw = await callClaude(
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
