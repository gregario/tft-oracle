import type Database from 'better-sqlite3';
import { z } from 'zod';

// --- Input Schema ---

export const GetItemRecipeInput = z.object({
  name: z.string().describe('Item name to look up (e.g. "Infinity Edge", "B.F. Sword")'),
});

export type GetItemRecipeInputType = z.infer<typeof GetItemRecipeInput>;

// --- Result types ---

export interface ItemDetail {
  name: string;
  apiName: string;
  description: string | null;
  effects: Record<string, number> | null;
  isComponent: boolean;
  unique: boolean;
  tags: string | null;
}

export interface ItemRecipeResult {
  item: ItemDetail;
  components?: ItemDetail[];
  buildsInto?: Array<{ item: ItemDetail; otherComponent: ItemDetail }>;
}

export interface GetItemRecipeResult {
  result: ItemRecipeResult;
}

export interface GetItemRecipeError {
  error: string;
  suggestions: string[];
}

// --- Helpers ---

interface ItemRow {
  name: string;
  apiName: string;
  description: string | null;
  effects: string | null;
  composition: string | null;
  tags: string | null;
  isComponent: number;
  unique_: number;
}

function rowToDetail(row: ItemRow): ItemDetail {
  let effects: Record<string, number> | null = null;
  if (row.effects) {
    try {
      effects = JSON.parse(row.effects) as Record<string, number>;
    } catch {
      effects = null;
    }
  }
  return {
    name: row.name,
    apiName: row.apiName,
    description: row.description,
    effects,
    isComponent: row.isComponent === 1,
    unique: row.unique_ === 1,
    tags: row.tags,
  };
}

function findItemByName(db: Database.Database, name: string): ItemRow | undefined {
  // Exact match (case-insensitive)
  const exact = db
    .prepare('SELECT * FROM items WHERE LOWER(name) = LOWER(?)')
    .get(name) as ItemRow | undefined;
  if (exact) return exact;

  // FTS5 fuzzy search — take best match
  try {
    const fts = db
      .prepare(
        `SELECT i.* FROM items_fts fts
         JOIN items i ON i.rowid = fts.rowid
         WHERE items_fts MATCH ?
         ORDER BY fts.rank
         LIMIT 1`,
      )
      .get(name) as ItemRow | undefined;
    if (fts) return fts;
  } catch {
    // FTS query might fail on special characters
  }

  return undefined;
}

function getSuggestions(db: Database.Database, name: string): string[] {
  // LIKE-based suggestions
  const rows = db
    .prepare("SELECT name FROM items WHERE LOWER(name) LIKE LOWER(?) LIMIT 5")
    .all(`%${name}%`) as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

// --- Handler ---

export function getItemRecipe(
  db: Database.Database,
  input: GetItemRecipeInputType,
): GetItemRecipeResult | GetItemRecipeError {
  const item = findItemByName(db, input.name);

  if (!item) {
    const suggestions = getSuggestions(db, input.name);
    return {
      error: `Item "${input.name}" not found.`,
      suggestions,
    };
  }

  const detail = rowToDetail(item);

  // Completed item (has composition) — show its component recipe
  if (item.composition && item.isComponent === 0) {
    let componentApiNames: string[] = [];
    try {
      componentApiNames = JSON.parse(item.composition) as string[];
    } catch {
      // empty
    }

    const components: ItemDetail[] = [];
    for (const apiName of componentApiNames) {
      const compRow = db
        .prepare('SELECT * FROM items WHERE apiName = ?')
        .get(apiName) as ItemRow | undefined;
      if (compRow) {
        components.push(rowToDetail(compRow));
      }
    }

    return {
      result: {
        item: detail,
        components,
      },
    };
  }

  // Component item — show all completed items that use this component (reverse lookup)
  const completedRows = db
    .prepare(
      "SELECT * FROM items WHERE isComponent = 0 AND composition LIKE '%' || ? || '%'",
    )
    .all(item.apiName) as ItemRow[];

  const buildsInto: Array<{ item: ItemDetail; otherComponent: ItemDetail }> = [];
  for (const completedRow of completedRows) {
    let compApiNames: string[] = [];
    try {
      compApiNames = JSON.parse(completedRow.composition ?? '[]') as string[];
    } catch {
      // empty
    }

    // Find the other component (the one that isn't this item)
    const otherApiName = compApiNames.find((a) => a !== item.apiName) ?? compApiNames[0];
    let otherComponent: ItemDetail | null = null;
    if (otherApiName) {
      const otherRow = db
        .prepare('SELECT * FROM items WHERE apiName = ?')
        .get(otherApiName) as ItemRow | undefined;
      if (otherRow) {
        otherComponent = rowToDetail(otherRow);
      }
    }

    if (otherComponent) {
      buildsInto.push({
        item: rowToDetail(completedRow),
        otherComponent,
      });
    } else {
      buildsInto.push({
        item: rowToDetail(completedRow),
        otherComponent: detail, // self-combine (e.g. two of same component)
      });
    }
  }

  return {
    result: {
      item: detail,
      buildsInto,
    },
  };
}
