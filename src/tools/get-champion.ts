import type Database from 'better-sqlite3';
import { z } from 'zod';

// --- Input Schema ---

export const GetChampionInput = z.object({
  name: z.string().describe('Champion name to look up (exact or partial match)'),
});

export type GetChampionInputType = z.infer<typeof GetChampionInput>;

// --- Result types ---

export interface ChampionAbility {
  name: string;
  description: string;
  variables: Array<{ name: string; value: number | number[] | null }>;
}

export interface ChampionDetail {
  name: string;
  cost: number;
  role: string | null;
  hp: number | null;
  ad: number | null;
  armor: number | null;
  mr: number | null;
  attackSpeed: number | null;
  mana: number;
  initialMana: number;
  range: number;
  critChance: number | null;
  critMultiplier: number | null;
  traits: string[];
  ability: ChampionAbility;
}

export interface GetChampionFoundResult {
  found: true;
  champion: ChampionDetail;
}

export interface GetChampionNotFoundResult {
  found: false;
  message: string;
  suggestions?: string[];
}

export type GetChampionResult = GetChampionFoundResult | GetChampionNotFoundResult;

// --- Raw row type ---

interface ChampionRow {
  name: string;
  apiName: string;
  cost: number;
  role: string | null;
  hp: number | null;
  ad: number | null;
  armor: number | null;
  mr: number | null;
  attackSpeed: number | null;
  mana: number;
  initialMana: number;
  range: number;
  critChance: number | null;
  critMultiplier: number | null;
  abilityName: string | null;
  abilityDesc: string | null;
  abilityVariables: string | null;
}

// --- Helper: parse ability variables JSON ---

function parseAbilityVariables(raw: string | null): Array<{ name: string; value: number | number[] | null }> {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Array<{ name: string; value: number | number[] | null }>;
  } catch {
    return [];
  }
}

// --- Helper: get traits for a champion ---

function getTraits(db: Database.Database, championName: string): string[] {
  const rows = db
    .prepare('SELECT trait_name FROM champion_traits WHERE champion_name = ? ORDER BY trait_name')
    .all(championName) as Array<{ trait_name: string }>;
  return rows.map((r) => r.trait_name);
}

// --- Helper: row to ChampionDetail ---

function toChampionDetail(db: Database.Database, row: ChampionRow): ChampionDetail {
  return {
    name: row.name,
    cost: row.cost,
    role: row.role,
    hp: row.hp,
    ad: row.ad,
    armor: row.armor,
    mr: row.mr,
    attackSpeed: row.attackSpeed,
    mana: row.mana,
    initialMana: row.initialMana,
    range: row.range,
    critChance: row.critChance,
    critMultiplier: row.critMultiplier,
    traits: getTraits(db, row.name),
    ability: {
      name: row.abilityName ?? '',
      description: row.abilityDesc ?? '',
      variables: parseAbilityVariables(row.abilityVariables),
    },
  };
}

// --- Handler ---

export function getChampion(
  db: Database.Database,
  input: GetChampionInputType,
): GetChampionResult {
  // 1. Exact match (case-insensitive)
  const exact = db
    .prepare('SELECT * FROM champions WHERE LOWER(name) = LOWER(?)')
    .get(input.name) as ChampionRow | undefined;

  if (exact) {
    return { found: true, champion: toChampionDetail(db, exact) };
  }

  // 2. Fuzzy match via FTS5
  const ftsMatch = db
    .prepare(
      `SELECT c.* FROM champions_fts fts
       JOIN champions c ON c.rowid = fts.rowid
       WHERE champions_fts MATCH ?
       ORDER BY fts.rank
       LIMIT 1`,
    )
    .get(input.name) as ChampionRow | undefined;

  if (ftsMatch) {
    return { found: true, champion: toChampionDetail(db, ftsMatch) };
  }

  // 3. Not found — provide suggestions
  const firstWord = input.name.split(/\s+/)[0];
  const suggestions = db
    .prepare('SELECT name FROM champions WHERE LOWER(name) LIKE LOWER(?) LIMIT 5')
    .all(`%${firstWord}%`) as Array<{ name: string }>;

  const suggestionNames = suggestions.map((s) => s.name);

  return {
    found: false,
    message: `No champion found matching "${input.name}".`,
    suggestions: suggestionNames.length > 0 ? suggestionNames : undefined,
  };
}
