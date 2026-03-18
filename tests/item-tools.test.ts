import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchItems } from '../src/tools/search-items.js';
import { getItemRecipe } from '../src/tools/get-item-recipe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, '..', 'src', 'data', 'schema.sql');

// --- Test fixtures ---

const COMPONENTS = [
  {
    name: 'B.F. Sword',
    apiName: 'TFT_Item_BFSword',
    description: 'Grants bonus attack damage.',
    effects: JSON.stringify({ AD: 10 }),
    composition: JSON.stringify([]),
    tags: 'offensive',
    isComponent: 1,
    unique_: 0,
  },
  {
    name: 'Needlessly Large Rod',
    apiName: 'TFT_Item_NeedlesslyLargeRod',
    description: 'Grants bonus ability power.',
    effects: JSON.stringify({ AP: 10 }),
    composition: JSON.stringify([]),
    tags: 'offensive',
    isComponent: 1,
    unique_: 0,
  },
  {
    name: 'Chain Vest',
    apiName: 'TFT_Item_ChainVest',
    description: 'Grants bonus armor.',
    effects: JSON.stringify({ Armor: 20 }),
    composition: JSON.stringify([]),
    tags: 'defensive',
    isComponent: 1,
    unique_: 0,
  },
];

const COMPLETED_ITEMS = [
  {
    name: 'Infinity Edge',
    apiName: 'TFT_Item_InfinityEdge',
    description: 'The wearer gains bonus critical strike chance and damage.',
    effects: JSON.stringify({ CritChance: 75, CritDamage: 35, AD: 35 }),
    composition: JSON.stringify(['TFT_Item_BFSword', 'TFT_Item_BFSword']),
    tags: 'offensive',
    isComponent: 0,
    unique_: 1,
  },
  {
    name: 'Hextech Gunblade',
    apiName: 'TFT_Item_HextechGunblade',
    description: 'The wearer heals for a percentage of all damage dealt.',
    effects: JSON.stringify({ Omnivamp: 25, AD: 15, AP: 15 }),
    composition: JSON.stringify(['TFT_Item_BFSword', 'TFT_Item_NeedlesslyLargeRod']),
    tags: 'offensive',
    isComponent: 0,
    unique_: 0,
  },
  {
    name: 'Guardian Angel',
    apiName: 'TFT_Item_GuardianAngel',
    description: 'Prevents the wearer from dying once per combat.',
    effects: JSON.stringify({ AD: 15, Armor: 30 }),
    composition: JSON.stringify(['TFT_Item_BFSword', 'TFT_Item_ChainVest']),
    tags: 'defensive',
    isComponent: 0,
    unique_: 1,
  },
];

// --- Setup ---

let db: Database.Database;

beforeAll(() => {
  db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);

  const insertItem = db.prepare(`
    INSERT INTO items (name, apiName, description, effects, composition, tags, isComponent, unique_)
    VALUES (@name, @apiName, @description, @effects, @composition, @tags, @isComponent, @unique_)
  `);

  const insertAll = db.transaction((items: typeof COMPONENTS) => {
    for (const item of items) {
      insertItem.run(item);
    }
  });

  insertAll([...COMPONENTS, ...COMPLETED_ITEMS]);
});

afterAll(() => {
  db.close();
});

// --- searchItems tests ---

describe('searchItems', () => {
  it('searches items by name via FTS', () => {
    const result = searchItems(db, { query: 'Sword' });
    expect(result.total).toBeGreaterThanOrEqual(1);
    const names = result.items.map((i) => i.name);
    expect(names).toContain('B.F. Sword');
  });

  it('searches items by description via FTS', () => {
    const result = searchItems(db, { query: 'critical strike' });
    expect(result.total).toBeGreaterThanOrEqual(1);
    const names = result.items.map((i) => i.name);
    expect(names).toContain('Infinity Edge');
  });

  it('filters by component name', () => {
    const result = searchItems(db, { component: 'B.F. Sword' });
    expect(result.total).toBeGreaterThanOrEqual(1);
    // Should return completed items that use B.F. Sword
    const names = result.items.map((i) => i.name);
    expect(names).toContain('Infinity Edge');
    expect(names).toContain('Hextech Gunblade');
    expect(names).toContain('Guardian Angel');
  });

  it('filters componentsOnly', () => {
    const result = searchItems(db, { componentsOnly: true });
    expect(result.total).toBe(3);
    for (const item of result.items) {
      expect(item.isComponent).toBe(true);
    }
  });

  it('returns composition summary for completed items', () => {
    const result = searchItems(db, { query: 'Infinity Edge' });
    const ie = result.items.find((i) => i.name === 'Infinity Edge');
    expect(ie).toBeDefined();
    expect(ie!.composition).toContain('B.F. Sword');
  });

  it('returns empty results for unknown component', () => {
    const result = searchItems(db, { component: 'Nonexistent Component' });
    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
  });

  it('respects limit', () => {
    const result = searchItems(db, { limit: 2 });
    expect(result.total).toBeLessThanOrEqual(2);
  });

  it('returns all items with no filters', () => {
    const result = searchItems(db, {});
    expect(result.total).toBe(6); // 3 components + 3 completed
  });
});

// --- getItemRecipe tests ---

describe('getItemRecipe', () => {
  it('returns recipe for a completed item', () => {
    const result = getItemRecipe(db, { name: 'Infinity Edge' });
    expect('result' in result).toBe(true);
    if (!('result' in result)) return;

    expect(result.result.item.name).toBe('Infinity Edge');
    expect(result.result.components).toBeDefined();
    expect(result.result.components!.length).toBe(2);
    expect(result.result.components![0].name).toBe('B.F. Sword');
    expect(result.result.components![1].name).toBe('B.F. Sword');
  });

  it('returns builds-into for a component item', () => {
    const result = getItemRecipe(db, { name: 'B.F. Sword' });
    expect('result' in result).toBe(true);
    if (!('result' in result)) return;

    expect(result.result.item.name).toBe('B.F. Sword');
    expect(result.result.item.isComponent).toBe(true);
    expect(result.result.buildsInto).toBeDefined();
    expect(result.result.buildsInto!.length).toBe(3);

    const builtNames = result.result.buildsInto!.map((b) => b.item.name).sort();
    expect(builtNames).toEqual(['Guardian Angel', 'Hextech Gunblade', 'Infinity Edge']);
  });

  it('shows the other component in builds-into', () => {
    const result = getItemRecipe(db, { name: 'Chain Vest' });
    expect('result' in result).toBe(true);
    if (!('result' in result)) return;

    expect(result.result.buildsInto).toBeDefined();
    expect(result.result.buildsInto!.length).toBe(1);
    expect(result.result.buildsInto![0].item.name).toBe('Guardian Angel');
    expect(result.result.buildsInto![0].otherComponent.name).toBe('B.F. Sword');
  });

  it('matches case-insensitively', () => {
    const result = getItemRecipe(db, { name: 'infinity edge' });
    expect('result' in result).toBe(true);
    if (!('result' in result)) return;
    expect(result.result.item.name).toBe('Infinity Edge');
  });

  it('uses FTS fuzzy match when exact match fails', () => {
    const result = getItemRecipe(db, { name: 'Gunblade' });
    expect('result' in result).toBe(true);
    if (!('result' in result)) return;
    expect(result.result.item.name).toBe('Hextech Gunblade');
  });

  it('returns error with suggestions when not found', () => {
    const result = getItemRecipe(db, { name: 'Zzz Nonexistent' });
    expect('error' in result).toBe(true);
    if (!('error' in result)) return;
    expect(result.error).toContain('not found');
    expect(Array.isArray(result.suggestions)).toBe(true);
  });

  it('returns effects as parsed object', () => {
    const result = getItemRecipe(db, { name: 'Infinity Edge' });
    expect('result' in result).toBe(true);
    if (!('result' in result)) return;
    expect(result.result.item.effects).toEqual({ CritChance: 75, CritDamage: 35, AD: 35 });
  });
});
