import type Database from 'better-sqlite3';
import { z } from 'zod';

// --- Input Schema ---

export const SearchAugmentsInput = z.object({
  query: z
    .string()
    .optional()
    .describe('Free-text search across augment name and description (uses FTS5)'),
  limit: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe('Max results to return, 1-50 (default: 20)'),
});

export type SearchAugmentsInputType = z.infer<typeof SearchAugmentsInput>;

// --- Result types ---

export interface AugmentSummary {
  name: string;
  description: string;
}

export interface SearchAugmentsResult {
  augments: AugmentSummary[];
  total: number;
}

// --- Handler ---

export function searchAugments(
  db: Database.Database,
  input: SearchAugmentsInputType,
): SearchAugmentsResult {
  const limit = input.limit ?? 20;

  let sql: string;
  const params: unknown[] = [];

  if (input.query) {
    params.push(input.query, limit);
    sql = `
      SELECT a.name, a.description
      FROM augments_fts fts
      JOIN augments a ON a.rowid = fts.rowid
      WHERE augments_fts MATCH ?
      ORDER BY fts.rank
      LIMIT ?
    `;
  } else {
    params.push(limit);
    sql = `
      SELECT name, description
      FROM augments
      ORDER BY name
      LIMIT ?
    `;
  }

  const rows = db.prepare(sql).all(...params) as Array<{
    name: string;
    description: string | null;
  }>;

  const augments: AugmentSummary[] = rows.map((row) => ({
    name: row.name,
    description: row.description ?? '',
  }));

  return { augments, total: augments.length };
}
