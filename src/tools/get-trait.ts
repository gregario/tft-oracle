import type Database from 'better-sqlite3';
import { z } from 'zod';
import type { TraitBreakpoint } from '../data/types.js';

// --- Input Schema ---

export const GetTraitInput = z.object({
  name: z.string().describe('Trait name to look up (exact or partial match)'),
});

export type GetTraitInputType = z.infer<typeof GetTraitInput>;

// --- Result types ---

export interface TraitChampion {
  name: string;
  cost: number;
}

export interface TraitDetail {
  name: string;
  description: string;
  breakpoints: TraitBreakpoint[];
  champions: TraitChampion[];
}

export type GetTraitResult =
  | { found: true; trait: TraitDetail }
  | { found: false; message: string; suggestions?: string[] };

// --- Helpers ---

function parseBreakpoints(raw: string | null): TraitBreakpoint[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as TraitBreakpoint[];
  } catch {
    return [];
  }
}

interface TraitRow {
  name: string;
  apiName: string;
  description: string | null;
  breakpoints: string | null;
}

function toTraitDetail(db: Database.Database, row: TraitRow): TraitDetail {
  const champions = db
    .prepare(
      `SELECT c.name, c.cost
       FROM champion_traits ct
       JOIN champions c ON c.name = ct.champion_name
       WHERE ct.trait_name = ?
       ORDER BY c.cost ASC, c.name ASC`,
    )
    .all(row.name) as TraitChampion[];

  return {
    name: row.name,
    description: row.description ?? '',
    breakpoints: parseBreakpoints(row.breakpoints),
    champions,
  };
}

// --- Handler ---

export function getTrait(
  db: Database.Database,
  input: GetTraitInputType,
): GetTraitResult {
  // 1. Exact match (case-insensitive)
  const exact = db
    .prepare('SELECT * FROM traits WHERE LOWER(name) = LOWER(?)')
    .get(input.name) as TraitRow | undefined;

  if (exact) {
    return { found: true, trait: toTraitDetail(db, exact) };
  }

  // 2. LIKE partial match (case-insensitive)
  const likeRow = db
    .prepare('SELECT * FROM traits WHERE LOWER(name) LIKE LOWER(?)')
    .get(`%${input.name}%`) as TraitRow | undefined;

  if (likeRow) {
    return { found: true, trait: toTraitDetail(db, likeRow) };
  }

  // 3. FTS5 match
  try {
    const ftsRow = db
      .prepare(
        `SELECT t.*
         FROM traits_fts fts
         JOIN traits t ON t.rowid = fts.rowid
         WHERE traits_fts MATCH ?
         ORDER BY fts.rank
         LIMIT 1`,
      )
      .get(input.name) as TraitRow | undefined;

    if (ftsRow) {
      return { found: true, trait: toTraitDetail(db, ftsRow) };
    }
  } catch {
    // FTS5 can throw on invalid query syntax — fall through to not found
  }

  // 4. Not found — provide suggestions
  const firstWord = input.name.split(/\s+/)[0];
  const suggestions = db
    .prepare('SELECT name FROM traits WHERE LOWER(name) LIKE LOWER(?) LIMIT 5')
    .all(`%${firstWord}%`) as Array<{ name: string }>;

  const suggestionNames = suggestions.map((s) => s.name);

  return {
    found: false,
    message: `No trait found matching "${input.name}".`,
    suggestions: suggestionNames.length > 0 ? suggestionNames : undefined,
  };
}
