import type Database from 'better-sqlite3';
import { z } from 'zod';

// --- Input Schema ---

export const SearchTraitsInput = z.object({
  query: z
    .string()
    .optional()
    .describe('Free-text search across trait name and description (uses FTS5)'),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .default(50)
    .describe('Max results to return, 1-100 (default: 50)'),
});

export type SearchTraitsInputType = z.infer<typeof SearchTraitsInput>;

// --- Result types ---

export interface TraitSummary {
  name: string;
  description: string;
  breakpointCount: number;
}

export interface SearchTraitsResult {
  traits: TraitSummary[];
  total: number;
}

// --- Helpers ---

function parseBreakpoints(raw: string | null): unknown[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as unknown[];
  } catch {
    return [];
  }
}

function truncate(text: string | null, maxLen: number): string {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

// --- Handler ---

export function searchTraits(
  db: Database.Database,
  input: SearchTraitsInputType,
): SearchTraitsResult {
  const limit = input.limit ?? 50;

  let rows: Array<{ name: string; description: string | null; breakpoints: string | null }>;

  if (input.query) {
    rows = db
      .prepare(
        `SELECT t.name, t.description, t.breakpoints
         FROM traits_fts fts
         JOIN traits t ON t.rowid = fts.rowid
         WHERE traits_fts MATCH ?
         ORDER BY fts.rank
         LIMIT ?`,
      )
      .all(input.query, limit) as typeof rows;
  } else {
    rows = db
      .prepare(
        `SELECT name, description, breakpoints
         FROM traits
         ORDER BY name
         LIMIT ?`,
      )
      .all(limit) as typeof rows;
  }

  const traits: TraitSummary[] = rows.map((row) => ({
    name: row.name,
    description: truncate(row.description, 100),
    breakpointCount: parseBreakpoints(row.breakpoints).length,
  }));

  return { traits, total: traits.length };
}
