'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
// Upload via client-side direct upload (no body size limit)

interface AnalysisEntry {
  id: string;
  companyName: string;
  createdAt: string;
  status: string;
}

interface UploadedFile {
  file: File;
  path: string; // includes folder path if from directory
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  blobUrl?: string;
}

export default function Home() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState('');
  const [analyses, setAnalyses] = useState<AnalysisEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/analyses')
      .then(r => r.json())
      .then(data => setAnalyses(data.analyses || []))
      .catch(() => {});
  }, []);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles).map(f => ({
      file: f,
      path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
      status: 'pending' as const,
      progress: 0,
    }));
    setFiles(prev => [...prev, ...arr]);
  }, []);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const items = e.dataTransfer.items;
    if (items) {
      const filePromises: Promise<File>[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry?.();
          if (entry) {
            collectFiles(entry, '', filePromises);
          } else {
            const f = item.getAsFile();
            if (f) filePromises.push(Promise.resolve(f));
          }
        }
      }
      Promise.all(filePromises).then(collected => {
        if (collected.length > 0) addFiles(collected);
      });
    } else {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handleSubmit = async () => {
    if (!companyName && !text && files.length === 0) {
      setError('Please provide a company name, paste text, or upload files');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Upload files to Vercel Blob first
      const uploadedFiles: { url: string; name: string; size: number }[] = [];

      if (files.length > 0) {
        setUploadProgress(`Uploading 0/${files.length} files...`);

        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          setFiles(prev => prev.map((pf, j) => j === i ? { ...pf, status: 'uploading' } : pf));
          setUploadProgress(`Uploading ${i + 1}/${files.length}: ${f.file.name} (${formatSize(f.file.size)})`);

          try {
            // Client-side direct upload — bypasses serverless body size limit
            const blob = await upload(`uploads/${Date.now()}-${f.file.name}`, f.file, {
              access: 'public',
              handleUploadUrl: '/api/upload',
            });

            uploadedFiles.push({ url: blob.url, name: f.path, size: f.file.size });
            setFiles(prev => prev.map((pf, j) => j === i ? { ...pf, status: 'done', progress: 100, blobUrl: blob.url } : pf));
          } catch (err) {
            console.error(`Upload failed for ${f.file.name}:`, err);
            setFiles(prev => prev.map((pf, j) => j === i ? { ...pf, status: 'error' } : pf));
            setError(`Upload failed for "${f.file.name}". Please try again or remove the file.`);
            setLoading(false);
            setUploadProgress('');
            return;
          }
        }

        // Check if any uploads failed
        if (uploadedFiles.length === 0 && files.length > 0) {
          setError('All file uploads failed. Please try again.');
          setLoading(false);
          setUploadProgress('');
          return;
        }

        setUploadProgress('Analyzing...');
      }

      // Send analysis request with blob URLs (small JSON, no file data)
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          text,
          files: uploadedFiles,
        }),
      });

      if (!res.ok) {
        let errMsg = 'Analysis failed';
        try {
          const data = await res.json();
          errMsg = data.error || errMsg;
        } catch {
          errMsg = `Server error (${res.status})`;
        }
        throw new Error(errMsg);
      }

      const data = await res.json();
      router.push(`/analysis/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setLoading(false);
      setUploadProgress('');
    }
  };

  const totalSize = files.reduce((acc, f) => acc + f.file.size, 0);

  return (
    <div className="max-w-lg mx-auto px-5 py-10">
      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          New Analysis
        </h1>
        <p className="text-text-muted text-sm mt-1">
          Upload files or enter company details for multi-agent analysis.
        </p>
      </div>

      {/* Input Card */}
      <div className="mb-10">
        {/* Company Name */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-text-secondary mb-2">Company Name</label>
          <input
            type="text"
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            placeholder="e.g., Stripe, Toyota, SpaceX..."
            className="w-full bg-white border border-border rounded-lg px-4 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          />
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-text-muted text-sm">and / or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Text Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-text-secondary mb-2">Paste Company Information</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Paste company description, pitch deck text, financial data, or any relevant information..."
            rows={6}
            className="w-full bg-white border border-border rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors resize-y text-sm"
            style={{ fontFamily: 'var(--font-body)' }}
          />
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-text-muted text-sm">and / or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">Upload Files or Folders</label>
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-accent bg-accent/5' : files.length > 0 ? 'border-success bg-success/5' : 'border-border hover:border-border-bright'
            }`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.pptx,.csv,.txt,.doc,.docx,.xls,.xlsx,.json,.md,.html"
              className="hidden"
              onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
            />
            <input
              ref={folderRef}
              type="file"
              // @ts-expect-error webkitdirectory is not in React types
              webkitdirectory=""
              directory=""
              multiple
              className="hidden"
              onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
            />

            {files.length === 0 ? (
              <div>
                <div className="text-3xl mb-2">📁</div>
                <p className="text-text-secondary">
                  Drag & drop files/folders or <span className="text-accent">browse files</span>
                </p>
                <p className="text-text-muted text-sm mt-1">PDF, PPTX, CSV, TXT, DOCX, XLSX, JSON, MD — up to 1GB total</p>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); folderRef.current?.click(); }}
                  className="mt-3 text-sm text-accent hover:text-accent-hover underline"
                >
                  Or select a folder
                </button>
              </div>
            ) : (
              <div onClick={e => e.stopPropagation()}>
                <p className="text-text-secondary text-sm mb-2">
                  {files.length} file{files.length !== 1 ? 's' : ''} · {formatSize(totalSize)}
                </p>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-sm text-accent hover:text-accent-hover underline mr-4"
                >
                  + Add more files
                </button>
                <button
                  type="button"
                  onClick={() => folderRef.current?.click()}
                  className="text-sm text-accent hover:text-accent-hover underline"
                >
                  + Add folder
                </button>
              </div>
            )}
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="mt-3 max-h-48 overflow-y-auto border border-border rounded-xl divide-y divide-border">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="text-text-muted flex-shrink-0">
                    {f.status === 'done' ? (
                      <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    ) : f.status === 'uploading' ? (
                      <svg className="animate-spin w-4 h-4 text-accent" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    ) : f.status === 'error' ? (
                      <span className="text-warning text-xs font-medium" title="Upload failed — text will be used instead">⚠</span>
                    ) : (
                      <span className="text-text-muted">📄</span>
                    )}
                  </span>
                  <span className="flex-1 truncate text-text-primary">{f.path}</span>
                  <span className="text-text-muted text-xs flex-shrink-0">{formatSize(f.file.size)}</span>
                  {!loading && (
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-text-muted hover:text-danger text-xs flex-shrink-0 ml-1"
                      title="Remove file"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm">{error}</div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || (!companyName && !text && files.length === 0)}
          className="w-full mt-6 py-3.5 bg-text-primary hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm rounded-full transition-all"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {uploadProgress || 'Launching Analysis Agents...'}
            </span>
          ) : (
            '🚀 Analyze Company'
          )}
        </button>
      </div>

      {/* Recent Analyses */}
      {analyses.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-4 text-text-primary">Recent Analyses</h2>
          <div className="grid gap-3">
            {analyses.map(a => (
              <div key={a.id} className="bg-bg-secondary border border-border rounded-xl p-4 hover:border-border-bright transition-colors flex items-center justify-between">
                <a href={`/analysis/${a.id}`} className="flex-1 min-w-0">
                  <h3 className="font-medium text-text-primary">{a.companyName}</h3>
                  <p className="text-sm text-text-muted">{new Date(a.createdAt).toLocaleString()}</p>
                </a>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    a.status === 'complete' ? 'bg-success/20 text-success' :
                    a.status === 'processing' ? 'bg-warning/20 text-warning' :
                    'bg-danger/20 text-danger'
                  }`}>
                    {a.status}
                  </span>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      await fetch(`/api/analysis/${a.id}`, { method: 'DELETE' });
                      setAnalyses(prev => prev.filter(x => x.id !== a.id));
                    }}
                    className="text-text-muted hover:text-danger text-xs p-1"
                    title="Delete"
                  >✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function collectFiles(entry: FileSystemEntry, path: string, promises: Promise<File>[]) {
  if (entry.isFile) {
    promises.push(
      new Promise<File>((resolve, reject) => {
        (entry as FileSystemFileEntry).file(f => {
          // Attach the relative path
          Object.defineProperty(f, 'webkitRelativePath', { value: path ? `${path}/${f.name}` : f.name });
          resolve(f);
        }, reject);
      })
    );
  } else if (entry.isDirectory) {
    const dirReader = (entry as FileSystemDirectoryEntry).createReader();
    promises.push(
      new Promise<File>((resolve, reject) => {
        dirReader.readEntries(entries => {
          const subPath = path ? `${path}/${entry.name}` : entry.name;
          entries.forEach(e => collectFiles(e, subPath, promises));
          // Return a dummy resolved promise — actual files are pushed to `promises`
          resolve(null as unknown as File);
        }, reject);
      })
    );
  }
}
