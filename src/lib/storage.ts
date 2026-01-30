import { put, list, del, head } from '@vercel/blob';
import { Analysis, AnalysisIndex } from './types';

const INDEX_KEY = 'analyses/index.json';

function analysisKey(id: string) {
  return `analyses/${id}.json`;
}

// ─── In-memory cache (per serverless instance) ───
// Avoids repeated blob list+fetch for the same analysis within a short window.
// Vercel serverless functions can reuse instances, so this helps a lot for
// polling (every 2s during processing) and repeated page loads.

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const analysisCache = new Map<string, CacheEntry<Analysis>>();
const INDEX_CACHE_KEY = '__index__';
const indexCache = { entry: null as CacheEntry<AnalysisIndex> | null };

// Completed analyses can be cached longer — they won't change (unless deepened)
const COMPLETE_TTL = 60_000;   // 60s for completed
const PROCESSING_TTL = 3_000;  // 3s for in-progress (allows polling to see updates)
const INDEX_TTL = 10_000;      // 10s for index

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T, ttl: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttl });
}

// ─── Blob URL resolution ───
// Since we use addRandomSuffix: false, the blob URL is deterministic once known.
// We cache the mapping from key → URL to avoid repeated list() calls.
const urlCache = new Map<string, string>();

async function resolveBlobUrl(key: string): Promise<string | null> {
  const cached = urlCache.get(key);
  if (cached) {
    // Verify it still exists with a fast HEAD instead of list
    try {
      await head(cached);
      return cached;
    } catch {
      urlCache.delete(key);
    }
  }
  // Fallback: list to discover URL
  const blobs = await list({ prefix: key });
  if (blobs.blobs.length === 0) return null;
  const url = blobs.blobs[0].url;
  urlCache.set(key, url);
  return url;
}

// ─── Public API ───

export async function getIndex(): Promise<AnalysisIndex> {
  // Check memory cache first
  if (indexCache.entry && Date.now() < indexCache.entry.expiresAt) {
    return indexCache.entry.data;
  }
  try {
    const url = await resolveBlobUrl(INDEX_KEY);
    if (!url) return { analyses: [] };
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    indexCache.entry = { data, expiresAt: Date.now() + INDEX_TTL };
    return data;
  } catch {
    return { analyses: [] };
  }
}

export async function saveIndex(index: AnalysisIndex): Promise<void> {
  const blob = await put(INDEX_KEY, JSON.stringify(index), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  urlCache.set(INDEX_KEY, blob.url);
  indexCache.entry = { data: index, expiresAt: Date.now() + INDEX_TTL };
}

export async function getAnalysis(id: string): Promise<Analysis | null> {
  // Check memory cache
  const cached = getCached(analysisCache, id);
  if (cached) return cached;

  try {
    const key = analysisKey(id);
    const url = await resolveBlobUrl(key);
    if (!url) return null;
    const res = await fetch(url, { cache: 'no-store' });
    const data: Analysis = await res.json();
    const ttl = data.status === 'complete' ? COMPLETE_TTL : PROCESSING_TTL;
    setCache(analysisCache, id, data, ttl);
    return data;
  } catch {
    return null;
  }
}

/**
 * Save an analysis to blob storage.
 * @param updateIndex - Set false during intermediate processing saves to skip
 *   the expensive index read+write cycle. Only the final save needs index sync.
 */
export async function saveAnalysis(analysis: Analysis, updateIndex = true): Promise<void> {
  const key = analysisKey(analysis.id);
  const blob = await put(key, JSON.stringify(analysis), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  urlCache.set(key, blob.url);

  // Update memory cache
  const ttl = analysis.status === 'complete' ? COMPLETE_TTL : PROCESSING_TTL;
  setCache(analysisCache, analysis.id, analysis, ttl);

  if (!updateIndex) return;

  // Update index
  const index = await getIndex();
  const existing = index.analyses.findIndex(a => a.id === analysis.id);
  const entry = {
    id: analysis.id,
    companyName: analysis.companyName,
    createdAt: analysis.createdAt,
    status: analysis.status,
  };
  if (existing >= 0) {
    index.analyses[existing] = entry;
  } else {
    index.analyses.unshift(entry);
  }
  await saveIndex(index);
}

export async function deleteAnalysis(id: string): Promise<void> {
  const key = analysisKey(id);
  try {
    const url = await resolveBlobUrl(key);
    if (url) await del(url);
  } catch { /* ignore */ }
  analysisCache.delete(id);
  urlCache.delete(key);

  const index = await getIndex();
  index.analyses = index.analyses.filter(a => a.id !== id);
  await saveIndex(index);
}

export async function uploadFile(id: string, filename: string, data: Buffer): Promise<string> {
  const blob = await put(`uploads/${id}/${filename}`, data, { access: 'public' });
  return blob.url;
}
