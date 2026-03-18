import type Database from 'better-sqlite3';
import { z } from 'zod';

// --- Input Schema ---

export const SearchItemsInput = z.object({
  query: z
    .string()
    .optional()
    .describe('Free-text search across item name and description (uses FTS5)'),
  component: z
    .string()
    .optional()
    .describe('Filter by component name (shows completed items that use this component)'),
  componentsOnly: z
    .boolean()
    .optional()
    .describe('Show only base components (not completed items)'),
  limit: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe('Max results to return, 1-50 (default: 20)'),
});

export type SearchItemsInputType = z.infer<typeof SearchItemsInput>;

// --- Result types ---

export interface ItemSummary {
  name: string;
  description: string | null;
  isComponent: boolean;
  composition: string | null;
}

export interface SearchItemsResult {
  items: ItemSummary[];
  total: number;
}

// --- Helpers ---

function truncate(text: string | null, maxLen = 120): string | null {
  if (!text) return null;
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

function compositionSummary(
  db: Database.Database,
  compositionJson: string | null,
): string | null {
  if (!compositionJson) return null;
  try {
    const apiNames = JSON.parse(compositionJson) as string[];
    if (!apiNames.length) return null;
    const placeholders = apiNames.map(() => '?').join(', ');
    const rows = db
      .prepare(`SELECT name FROM items WHERE apiName IN (${placeholders})`)
      .all(...apiNames) as Array<{ name: string }>;
    if (!rows.length) return apiNames.join(' + ');
    return rows.map((r) => r.name).join(' + ');
  } catch {
    return null;
  }
}

// --- Handler ---

export function searchItems(
  db: Database.Database,
  input: SearchItemsInputType,
): SearchItemsResult {
  const params: unknown[] = [];
  const conditions: string[] = [];
  const useFts = !!input.query;

  // componentsOnly filter
  if (input.componentsOnly) {
    conditions.push('i.isComponent = 1');
  }

  // component filter: find items whose composition contains this component's apiName
  if (input.component) {
    // First resolve the component name to its apiName
    const componentRow = db
      .prepare('SELECT apiName FROM items WHERE LOWER(name) = LOWER(?) AND isComponent = 1')
      .get(input.component) as { apiName: string } | undefined;

    if (componentRow) {
      conditions.push("i.composition LIKE '%' || ? || '%'");
      params.push(componentRow.apiName);
    } else {
      // Try partial match
      const fuzzyRow = db
        .prepare('SELECT apiName FROM items WHERE LOWER(name) LIKE LOWER(?) AND isComponent = 1')
        .get(`%${input.component}%`) as { apiName: string } | undefined;

      if (fuzzyRow) {
        conditions.push("i.composition LIKE '%' || ? || '%'");
        params.push(fuzzyRow.apiName);
      } else {
        // No matching component — return empty
        return { items: [], total: 0 };
      }
    }
  }

  const limit = input.limit ?? 20;

  let sql: string;
  const allParams: unknown[] = [];

  if (useFts) {
    allParams.push(input.query);
    allParams.push(...params);
    allParams.push(limit);

    const whereClause =
      conditions.length > 0 ? ' AND ' + conditions.join(' AND ') : '';

    sql = `
      SELECT i.name, i.description, i.isComponent, i.composition
      FROM items_fts fts
      JOIN items i ON i.rowid = fts.rowid
      WHERE items_fts MATCH ?${whereClause}
      ORDER BY fts.rank
      LIMIT ?
    `;
  } else {
    allParams.push(...params);
    allParams.push(limit);

    const whereClause =
      conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    sql = `
      SELECT i.name, i.description, i.isComponent, i.composition
      FROM items i
      ${whereClause}
      ORDER BY i.name
      LIMIT ?
    `;
  }

  const rows = db.prepare(sql).all(...allParams) as Array<{
    name: string;
    description: string | null;
    isComponent: number;
    composition: string | null;
  }>;

  const items: ItemSummary[] = rows.map((row) => ({
    name: row.name,
    description: truncate(row.description),
    isComponent: row.isComponent === 1,
    composition: compositionSummary(db, row.composition),
  }));

  return { items, total: items.length };
}
