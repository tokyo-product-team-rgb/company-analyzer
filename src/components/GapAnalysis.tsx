'use client';

import { useState } from 'react';
import { GapQuestion } from '@/lib/types';

const PRIORITY_COLORS = {
  high: 'text-danger border-danger/30 bg-danger/5',
  medium: 'text-warning border-warning/30 bg-warning/5',
  low: 'text-text-secondary border-border bg-bg-tertiary',
};

const PRIORITY_BADGES = {
  high: '🔴 High',
  medium: '🟡 Medium',
  low: '⚪ Low',
};

export default function GapAnalysis({
  questions,
  analysisId,
  onDeepen,
}: {
  questions: GapQuestion[];
  analysisId: string;
  onDeepen: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    // Map question IDs to actual questions for context
    const mappedAnswers: Record<string, string> = {};
    for (const q of questions) {
      if (answers[q.id]) {
        mappedAnswers[q.question] = answers[q.id];
      }
    }

    if (Object.keys(mappedAnswers).length === 0) return;

    setSubmitting(true);
    try {
      await fetch(`/api/analysis/${analysisId}/deepen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: mappedAnswers }),
      });
      onDeepen();
    } catch (error) {
      console.error('Deepen failed:', error);
    }
    setSubmitting(false);
  };

  const categories = [...new Set(questions.map(q => q.category))];

  return (
    <div className="space-y-6">
      <div className="bg-bg-secondary border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <span>🔍</span> Gap Analysis
        </h3>
        <p className="text-text-secondary text-sm mb-6">
          Answer these questions to deepen the analysis. The more context you provide, the better the results.
        </p>

        {categories.map(category => (
          <div key={category} className="mb-6">
            <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">{category}</h4>
            <div className="space-y-3">
              {questions.filter(q => q.category === category).map(q => (
                <div key={q.id} className={`border rounded-lg p-4 ${PRIORITY_COLORS[q.priority]}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <label htmlFor={q.id} className="text-sm font-medium text-text-primary">{q.question}</label>
                    <span className="text-xs whitespace-nowrap">{PRIORITY_BADGES[q.priority]}</span>
                  </div>
                  <textarea
                    id={q.id}
                    rows={2}
                    className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-y"
                    placeholder="Your answer..."
                    value={answers[q.id] || ''}
                    onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <button
          onClick={handleSubmit}
          disabled={submitting || Object.values(answers).every(v => !v.trim())}
          className="w-full py-3 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
        >
          {submitting ? 'Re-analyzing...' : '🔄 Deepen Analysis with Additional Context'}
        </button>
      </div>
    </div>
  );
}
