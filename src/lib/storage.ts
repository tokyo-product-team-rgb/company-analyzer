import { put, list, del } from '@vercel/blob';
import { Analysis, AnalysisIndex } from './types';

const INDEX_KEY = 'analyses/index.json';

function analysisKey(id: string) {
  return `analyses/${id}.json`;
}

export async function getIndex(): Promise<AnalysisIndex> {
  try {
    const blobs = await list({ prefix: INDEX_KEY });
    if (blobs.blobs.length === 0) return { analyses: [] };
    const res = await fetch(blobs.blobs[0].url);
    return await res.json();
  } catch {
    return { analyses: [] };
  }
}

export async function saveIndex(index: AnalysisIndex): Promise<void> {
  // Delete old index first
  try {
    const blobs = await list({ prefix: INDEX_KEY });
    for (const blob of blobs.blobs) {
      await del(blob.url);
    }
  } catch { /* ignore */ }
  await put(INDEX_KEY, JSON.stringify(index), { access: 'public', addRandomSuffix: false });
}

export async function getAnalysis(id: string): Promise<Analysis | null> {
  try {
    const blobs = await list({ prefix: analysisKey(id) });
    if (blobs.blobs.length === 0) return null;
    const res = await fetch(blobs.blobs[0].url);
    return await res.json();
  } catch {
    return null;
  }
}

export async function saveAnalysis(analysis: Analysis): Promise<void> {
  // Delete old version
  try {
    const blobs = await list({ prefix: analysisKey(analysis.id) });
    for (const blob of blobs.blobs) {
      await del(blob.url);
    }
  } catch { /* ignore */ }

  await put(analysisKey(analysis.id), JSON.stringify(analysis), { access: 'public', addRandomSuffix: false });

  // Update index
  const index = await getIndex();
  const existing = index.analyses.findIndex(a => a.id === analysis.id);
  const entry = { id: analysis.id, companyName: analysis.companyName, createdAt: analysis.createdAt, status: analysis.status };
  if (existing >= 0) {
    index.analyses[existing] = entry;
  } else {
    index.analyses.unshift(entry);
  }
  await saveIndex(index);
}

export async function deleteAnalysis(id: string): Promise<void> {
  // Delete the analysis blob
  try {
    const blobs = await list({ prefix: analysisKey(id) });
    for (const blob of blobs.blobs) {
      await del(blob.url);
    }
  } catch { /* ignore */ }

  // Remove from index
  const index = await getIndex();
  index.analyses = index.analyses.filter(a => a.id !== id);
  await saveIndex(index);
}

export async function uploadFile(id: string, filename: string, data: Buffer): Promise<string> {
  const blob = await put(`uploads/${id}/${filename}`, data, { access: 'public' });
  return blob.url;
}
