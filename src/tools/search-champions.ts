import type Database from 'better-sqlite3';
import { z } from 'zod';

// --- Input Schema ---

export const SearchChampionsInput = z.object({
  query: z
    .string()
    .optional()
    .describe('Free-text search across champion name and ability (uses FTS5)'),
  cost: z
    .number()
    .optional()
    .describe('Filter by champion cost (1-5)'),
  trait: z
    .string()
    .optional()
    .describe('Filter by trait name (e.g. Warrior, Bruiser)'),
  role: z
    .string()
    .optional()
    .describe('Filter by role (e.g. damage, support, tank)'),
  limit: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe('Max results to return, 1-50 (default: 20)'),
});

export type SearchChampionsInputType = z.infer<typeof SearchChampionsInput>;

// --- Result types ---

export interface ChampionSummary {
  name: string;
  cost: number;
  role: string | null;
  traits: string;
  hp: number | null;
  ad: number | null;
}

export interface SearchChampionsResult {
  champions: ChampionSummary[];
  total: number;
}

// --- Handler ---

export function searchChampions(
  db: Database.Database,
  input: SearchChampionsInputType,
): SearchChampionsResult {
  const params: unknown[] = [];
  const conditions: string[] = [];
  const joins: string[] = [];
  const useFts = !!input.query;

  // Cost filter
  if (input.cost != null) {
    conditions.push('c.cost = ?');
    params.push(input.cost);
  }

  // Role filter
  if (input.role) {
    conditions.push('LOWER(c.role) = LOWER(?)');
    params.push(input.role);
  }

  // Trait filter (JOIN champion_traits)
  if (input.trait) {
    joins.push('JOIN champion_traits ct ON ct.champion_name = c.name');
    conditions.push('LOWER(ct.trait_name) = LOWER(?)');
    params.push(input.trait);
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
    const joinClause = joins.join(' ');

    sql = `
      SELECT DISTINCT c.name, c.cost, c.role, c.hp, c.ad,
        (SELECT GROUP_CONCAT(ct2.trait_name, ', ')
         FROM champion_traits ct2
         WHERE ct2.champion_name = c.name) AS traits
      FROM champions_fts fts
      JOIN champions c ON c.rowid = fts.rowid
      ${joinClause}
      WHERE champions_fts MATCH ?${whereClause}
      ORDER BY fts.rank
      LIMIT ?
    `;
  } else {
    allParams.push(...params);
    allParams.push(limit);

    const whereClause =
      conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const joinClause = joins.join(' ');

    sql = `
      SELECT DISTINCT c.name, c.cost, c.role, c.hp, c.ad,
        (SELECT GROUP_CONCAT(ct2.trait_name, ', ')
         FROM champion_traits ct2
         WHERE ct2.champion_name = c.name) AS traits
      FROM champions c
      ${joinClause}
      ${whereClause}
      ORDER BY c.name
      LIMIT ?
    `;
  }

  const rows = db.prepare(sql).all(...allParams) as Array<{
    name: string;
    cost: number;
    role: string | null;
    traits: string | null;
    hp: number | null;
    ad: number | null;
  }>;

  const champions: ChampionSummary[] = rows.map((row) => ({
    name: row.name,
    cost: row.cost,
    role: row.role,
    traits: row.traits ?? '',
    hp: row.hp,
    ad: row.ad,
  }));

  return { champions, total: champions.length };
}
