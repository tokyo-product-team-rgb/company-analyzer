'use client';

import { AgentAnalysis } from '@/lib/types';

function renderMarkdown(text: string): string {
  // Simple markdown-to-HTML (tables, headers, bold, italic, lists, blockquotes, code)
  let html = text
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="border-border my-4" />')
    // Tables
    .replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match.split('|').filter(c => c.trim());
      if (cells.every(c => /^[\s-:]+$/.test(c))) return '<!-- table-sep -->';
      const isHeader = false; // Will be determined by context
      const tag = isHeader ? 'th' : 'td';
      return `<tr>${cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('')}</tr>`;
    });

  // Wrap table rows
  html = html.replace(/((?:<tr>.*<\/tr>\n?)+)/g, (match) => {
    const cleaned = match.replace(/<!-- table-sep -->\n?/g, '');
    const rows = cleaned.trim().split('\n').filter(r => r.startsWith('<tr>'));
    if (rows.length === 0) return match;
    const header = rows[0].replace(/<td>/g, '<th>').replace(/<\/td>/g, '</th>');
    const body = rows.slice(1).join('\n');
    return `<table><thead>${header}</thead><tbody>${body}</tbody></table>`;
  });

  // Lists (simple)
  html = html.replace(/^(\s*)- (.+)$/gm, '$1<li>$2</li>');
  html = html.replace(/^(\s*)\d+\. (.+)$/gm, '$1<li>$2</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // Paragraphs (lines that aren't already wrapped)
  html = html.replace(/^(?!<[a-z])((?!<).+)$/gm, '<p>$1</p>');

  return html;
}

export default function AnalysisContent({ agent }: { agent: AgentAnalysis }) {
  if (agent.status === 'error') {
    return (
      <div className="bg-danger/10 border border-danger/30 rounded-lg p-6">
        <h3 className="text-danger font-semibold mb-2">Analysis Error</h3>
        <p className="text-text-secondary">{agent.error || 'An unknown error occurred'}</p>
      </div>
    );
  }

  if (agent.status === 'skipped') {
    return (
      <div className="bg-gray-50 border border-border rounded-lg p-6 text-center">
        <div className="text-3xl mb-3 grayscale">⏭️</div>
        <h3 className="text-text-muted font-semibold mb-2">Agent Skipped</h3>
        <p className="text-text-muted text-sm">{agent.skippedReason || 'This agent was not relevant for this company and was skipped by the Manager Agent.'}</p>
      </div>
    );
  }

  if (agent.status === 'pending' || agent.status === 'running') {
    return (
      <div className="space-y-4 animate-pulse-slow">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-4 bg-bg-tertiary rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
        ))}
      </div>
    );
  }

  return (
    <div
      className="analysis-content"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(agent.content) }}
    />
  );
}
