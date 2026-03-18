import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { TftRawData } from './types.js';

// --- Constants ---

const COMMUNITY_DRAGON_URL =
  'https://raw.communitydragon.org/latest/cdragon/tft/en_us.json';
const DEFAULT_CACHE_DIR = path.join(os.homedir(), '.tft-oracle');
const CACHE_FILENAME = 'en_us.json';
const METADATA_FILENAME = 'fetch_metadata.json';

// Cache for 6 hours before re-checking
const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

// --- Types ---

interface FetchMetadata {
  lastFetched?: string;
  lastModified?: string;
}

// --- Helpers ---

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadMetadata(cacheDir: string): FetchMetadata {
  const metaPath = path.join(cacheDir, METADATA_FILENAME);
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as FetchMetadata;
  } catch {
    return {};
  }
}

function saveMetadata(cacheDir: string, meta: FetchMetadata): void {
  const metaPath = path.join(cacheDir, METADATA_FILENAME);
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
}

function isCacheFresh(cacheDir: string): boolean {
  const cachePath = path.join(cacheDir, CACHE_FILENAME);
  try {
    const stat = fs.statSync(cachePath);
    return Date.now() - stat.mtimeMs < CACHE_MAX_AGE_MS;
  } catch {
    return false;
  }
}

function loadCachedData(cacheDir: string): TftRawData | null {
  const cachePath = path.join(cacheDir, CACHE_FILENAME);
  try {
    const content = fs.readFileSync(cachePath, 'utf-8');
    return JSON.parse(content) as TftRawData;
  } catch {
    return null;
  }
}

// --- Public API ---

/**
 * Fetch TFT data from CommunityDragon with file-based caching.
 *
 * - Uses cached data if less than 6 hours old
 * - Uses If-Modified-Since for conditional requests
 * - Falls back to cached data on network failure
 * - Throws if no cache exists and fetch fails
 *
 * @param cacheDir - Directory for cached files. Defaults to ~/.tft-oracle/.
 * @param fetchFn - Optional fetch implementation (for testing/DI).
 */
export async function fetchTftData(
  cacheDir?: string,
  fetchFn: typeof fetch = fetch
): Promise<TftRawData> {
  const dir = cacheDir ?? DEFAULT_CACHE_DIR;
  ensureDir(dir);

  // If cache is fresh, use it directly
  if (isCacheFresh(dir)) {
    const cached = loadCachedData(dir);
    if (cached) {
      console.error('Using cached CommunityDragon data (< 6h old)');
      return cached;
    }
  }

  // Try to fetch with conditional request
  const meta = loadMetadata(dir);
  const headers: Record<string, string> = {};
  if (meta.lastModified) {
    headers['If-Modified-Since'] = meta.lastModified;
  }

  try {
    console.error(`Fetching TFT data from ${COMMUNITY_DRAGON_URL}...`);
    const response = await fetchFn(COMMUNITY_DRAGON_URL, { headers });

    if (response.status === 304) {
      // Not modified — use cache
      console.error('CommunityDragon returned 304 Not Modified, using cache');
      meta.lastFetched = new Date().toISOString();
      saveMetadata(dir, meta);
      // Touch the cache file to reset freshness timer
      const cachePath = path.join(dir, CACHE_FILENAME);
      const now = new Date();
      fs.utimesSync(cachePath, now, now);

      const cached = loadCachedData(dir);
      if (cached) return cached;
    }

    if (!response.ok) {
      throw new Error(
        `Failed to fetch TFT data: ${response.status} ${response.statusText}`
      );
    }

    const text = await response.text();
    const data = JSON.parse(text) as TftRawData;

    // Save to cache
    const cachePath = path.join(dir, CACHE_FILENAME);
    fs.writeFileSync(cachePath, text, 'utf-8');

    // Update metadata
    meta.lastFetched = new Date().toISOString();
    const lastModified = response.headers.get('Last-Modified');
    if (lastModified) {
      meta.lastModified = lastModified;
    }
    saveMetadata(dir, meta);

    console.error(`Fetched and cached TFT data (${(text.length / 1024 / 1024).toFixed(1)}MB)`);
    return data;
  } catch (error) {
    // Graceful degradation — try cached data
    const cached = loadCachedData(dir);
    if (cached) {
      console.error(
        `Failed to fetch TFT data, using cached data: ${error instanceof Error ? error.message : String(error)}`
      );
      return cached;
    }

    // No cache and fetch failed — fatal
    throw error;
  }
}
