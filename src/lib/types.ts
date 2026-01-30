export type AgentRole = 'researcher' | 'strategist' | 'sector' | 'financial' | 'aerospace' | 'nuclear' | 'biology' | 'ai_expert' | 'mechanical' | 'physics' | 'summary' | 'qa';

export interface AgentAnalysis {
  role: AgentRole;
  title: string;
  emoji: string;
  content: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  error?: string;
}

export interface GapQuestion {
  id: string;
  question: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
}

export interface Analysis {
  id: string;
  companyName: string;
  inputType: 'file' | 'text' | 'name';
  inputSummary: string;
  inputFull?: string;
  createdAt: string;
  updatedAt: string;
  status: 'processing' | 'complete' | 'error';
  currentStep?: string;
  processStartedAt?: string; // tracks when processing actually began
  agents: AgentAnalysis[];
  gapQuestions: GapQuestion[];
  webEnrichment?: string;
  deepenHistory: { answers: Record<string, string>; timestamp: string }[];
}

export interface AnalysisIndex {
  analyses: { id: string; companyName: string; createdAt: string; status: string }[];
}
