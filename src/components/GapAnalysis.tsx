'use client';

import { useState, useRef } from 'react';
import { upload } from '@vercel/blob/client';
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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface UploadedFile {
  file: File;
  questionId: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  blobUrl?: string;
}

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
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFileSelect = (questionId: string, selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    const newFiles: UploadedFile[] = Array.from(selectedFiles).map(f => ({
      file: f,
      questionId,
      status: 'pending',
    }));
    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const hasAnswers = Object.values(answers).some(v => v.trim());
    const hasFiles = files.length > 0;
    if (!hasAnswers && !hasFiles) return;

    setSubmitting(true);

    try {
      // Upload files first
      const uploadedFiles: { url: string; name: string; questionId: string }[] = [];

      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          setUploadProgress(`Uploading ${i + 1}/${files.length}: ${f.file.name}`);
          setFiles(prev => prev.map((pf, j) => j === i ? { ...pf, status: 'uploading' } : pf));

          try {
            const blob = await upload(`gap-uploads/${Date.now()}-${f.file.name}`, f.file, {
              access: 'public',
              handleUploadUrl: '/api/upload',
            });
            uploadedFiles.push({ url: blob.url, name: f.file.name, questionId: f.questionId });
            setFiles(prev => prev.map((pf, j) => j === i ? { ...pf, status: 'done', blobUrl: blob.url } : pf));
          } catch (err) {
            console.error(`Upload failed for ${f.file.name}:`, err);
            setFiles(prev => prev.map((pf, j) => j === i ? { ...pf, status: 'error' } : pf));
          }
        }
        setUploadProgress('');
      }

      // Map question IDs to actual questions for context
      const mappedAnswers: Record<string, string> = {};
      for (const q of questions) {
        if (answers[q.id]) {
          mappedAnswers[q.question] = answers[q.id];
        }
      }

      // Map files to questions
      const mappedFiles: Record<string, { url: string; name: string }[]> = {};
      for (const uf of uploadedFiles) {
        const question = questions.find(q => q.id === uf.questionId);
        if (question) {
          if (!mappedFiles[question.question]) mappedFiles[question.question] = [];
          mappedFiles[question.question].push({ url: uf.url, name: uf.name });
        }
      }

      await fetch(`/api/analysis/${analysisId}/deepen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: mappedAnswers, files: mappedFiles }),
      });
      onDeepen();
    } catch (error) {
      console.error('Deepen failed:', error);
    }
    setSubmitting(false);
  };

  const categories = [...new Set(questions.map(q => q.category))];
  const hasInput = Object.values(answers).some(v => v.trim()) || files.length > 0;

  return (
    <div className="space-y-6">
      <div className="bg-bg-secondary border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <span>🔍</span> Gap Analysis
        </h3>
        <p className="text-text-secondary text-sm mb-6">
          Answer these questions or upload files to deepen the analysis. The more context you provide, the better the results.
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
                    placeholder="Type your answer or upload a file below..."
                    value={answers[q.id] || ''}
                    onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  />

                  {/* File upload for this question */}
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      ref={el => { fileInputRefs.current[q.id] = el; }}
                      type="file"
                      multiple
                      accept=".pdf,.txt,.csv,.xlsx,.docx,.pptx,.json"
                      className="hidden"
                      onChange={e => handleFileSelect(q.id, e.target.files)}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRefs.current[q.id]?.click()}
                      className="text-xs px-3 py-1.5 rounded-md border border-border bg-bg-primary hover:bg-bg-tertiary text-text-secondary transition-colors flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      Attach file
                    </button>
                  </div>

                  {/* Show attached files for this question */}
                  {files.filter(f => f.questionId === q.id).length > 0 && (
                    <div className="mt-2 space-y-1">
                      {files.map((f, idx) => f.questionId === q.id ? (
                        <div key={idx} className="flex items-center gap-2 text-xs text-text-secondary bg-bg-primary rounded px-2 py-1">
                          {f.status === 'done' ? (
                            <span className="text-green-500">✓</span>
                          ) : f.status === 'uploading' ? (
                            <span className="animate-spin">⏳</span>
                          ) : f.status === 'error' ? (
                            <span className="text-danger">✗</span>
                          ) : (
                            <span>📎</span>
                          )}
                          <span className="truncate flex-1">{f.file.name}</span>
                          <span className="text-text-muted">{formatSize(f.file.size)}</span>
                          {f.status !== 'uploading' && (
                            <button onClick={() => removeFile(idx)} className="text-text-muted hover:text-danger">×</button>
                          )}
                        </div>
                      ) : null)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {uploadProgress && (
          <div className="mb-4 p-3 bg-accent/10 border border-accent/30 rounded-lg text-accent text-sm">
            {uploadProgress}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !hasInput}
          className="w-full py-3 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
        >
          {submitting ? 'Re-analyzing...' : '🔄 Deepen Analysis with Additional Context'}
        </button>
      </div>
    </div>
  );
}
