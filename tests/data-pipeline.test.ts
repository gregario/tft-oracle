import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  detectCurrentSet,
  getSetData,
  parseChampions,
  parseTraits,
  parseItems,
  resolveDescription,
  stripMarkup,
  isAugment,
  isComponent,
} from '../src/data/parser.js';
import { getDatabase, hasExistingData, getMetadata, setMetadata } from '../src/data/db.js';
import { runPipeline } from '../src/data/pipeline.js';
import type { TftRawData, RawSetData, RawItem, RawVariable } from '../src/data/types.js';
import type Database from 'better-sqlite3';

// --- Mock data ---

function createMockSetData(): RawSetData {
  return {
    name: 'TestSet',
    champions: [
      {
        ability: {
          desc: 'Deals @TotalDamage@ damage to enemies. Scales @DamagePerStar@ per star.',
          icon: 'test.tex',
          name: 'Fireball',
          variables: [
            { name: 'TotalDamage', value: [0, 100, 150, 200] },
            { name: 'DamagePerStar', value: 50 },
            { name: null, value: null },
          ],
        },
        apiName: 'TFT16_TestChampion',
        characterName: 'TFT16_TestChampion',
        cost: 3,
        icon: 'test.tex',
        name: 'Test Champion',
        role: 'damage',
        squareIcon: 'test.tex',
        stats: {
          armor: 30,
          attackSpeed: 0.75,
          critChance: 0.25,
          critMultiplier: 1.4,
          damage: 60,
          hp: 800,
          initialMana: 30,
          magicResist: 30,
          mana: 80,
          range: 1,
        },
        tileIcon: 'test.tex',
        traits: ['Warrior', 'Bruiser'],
      },
      {
        ability: {
          desc: 'Heals allies for @HealAmount@.',
          icon: 'test.tex',
          name: 'Heal',
          variables: [{ name: 'HealAmount', value: [0, 200, 300, 400] }],
        },
        apiName: 'TFT16_TestSupport',
        characterName: 'TFT16_TestSupport',
        cost: 2,
        icon: 'test.tex',
        name: 'Test Support',
        role: 'support',
        squareIcon: 'test.tex',
        stats: {
          armor: 20,
          attackSpeed: 0.65,
          critChance: 0.25,
          critMultiplier: 1.4,
          damage: 40,
          hp: 600,
          initialMana: 40,
          magicResist: 20,
          mana: 60,
          range: 3,
        },
        tileIcon: 'test.tex',
        traits: ['Healer'],
      },
      // Non-playable unit (no traits) — should be filtered out
      {
        ability: {
          desc: 'Does nothing',
          icon: 'test.tex',
          name: 'Nothing',
          variables: [],
        },
        apiName: 'TFT_SpecialUnit',
        characterName: 'TFT_SpecialUnit',
        cost: 8,
        icon: 'test.tex',
        name: 'Special Unit',
        role: null,
        squareIcon: 'test.tex',
        stats: {
          armor: 10,
          attackSpeed: 1.0,
          critChance: null,
          critMultiplier: 0,
          damage: null,
          hp: 10,
          initialMana: 0,
          magicResist: 10,
          mana: 100,
          range: 0,
        },
        tileIcon: 'test.tex',
        traits: [],
      },
    ],
    traits: [
      {
        apiName: 'TFT16_Warrior',
        desc: 'Warriors gain @BonusAD@ Attack Damage.',
        effects: [
          {
            minUnits: 2,
            maxUnits: 3,
            style: 1,
            variables: { BonusAD: 10 },
          },
          {
            minUnits: 4,
            maxUnits: 6,
            style: 2,
            variables: { BonusAD: 30 },
          },
          {
            minUnits: 6,
            maxUnits: 25000,
            style: 3,
            variables: { BonusAD: 60 },
          },
        ],
        icon: 'test.tex',
        name: 'Warrior',
      },
      {
        apiName: 'TFT16_Healer',
        desc: 'Healers restore @HealPercent@% of max Health to allies.',
        effects: [
          {
            minUnits: 2,
            maxUnits: 25000,
            style: 1,
            variables: { HealPercent: 15 },
          },
        ],
        icon: 'test.tex',
        name: 'Healer',
      },
    ],
  };
}

function createMockItems(): RawItem[] {
  return [
    // Component
    {
      apiName: 'TFT_Item_BFSword',
      associatedTraits: [],
      composition: [],
      desc: '+10 Attack Damage',
      effects: { AD: 10 },
      from: null,
      icon: 'test.tex',
      id: 1,
      incompatibleTraits: [],
      name: 'B.F. Sword',
      tags: ['component', 'AttackDamage'],
      unique: false,
    },
    // Another component
    {
      apiName: 'TFT_Item_RecurveBow',
      associatedTraits: [],
      composition: [],
      desc: '+10% Attack Speed',
      effects: { AS: 10 },
      from: null,
      icon: 'test.tex',
      id: 2,
      incompatibleTraits: [],
      name: 'Recurve Bow',
      tags: ['component', 'AttackSpeed'],
      unique: false,
    },
    // Completed item (recipe)
    {
      apiName: 'TFT_Item_GiantSlayer',
      associatedTraits: [],
      composition: ['TFT_Item_BFSword', 'TFT_Item_RecurveBow'],
      desc: 'Deal bonus damage to high-HP enemies.',
      effects: { BonusDamage: 0.25 },
      from: null,
      icon: 'test.tex',
      id: 33,
      incompatibleTraits: [],
      name: 'Giant Slayer',
      tags: [],
      unique: false,
    },
    // Unique item
    {
      apiName: 'TFT_Item_ThiefsGloves',
      associatedTraits: [],
      composition: ['TFT_Item_SparringGloves', 'TFT_Item_SparringGloves'],
      desc: 'Each round, equip 2 random completed items.',
      effects: {},
      from: null,
      icon: 'test.tex',
      id: 44,
      incompatibleTraits: [],
      name: "Thief's Gloves",
      tags: [],
      unique: true,
    },
    // Current set augment
    {
      apiName: 'TFT16_Augment_WarriorCrown',
      associatedTraits: ['TFT16_Warrior'],
      composition: [],
      desc: 'Gain the Warrior trait and a Warrior emblem.',
      effects: {},
      from: null,
      icon: 'test.tex',
      id: null,
      incompatibleTraits: [],
      name: 'Warrior Crown',
      tags: [],
      unique: false,
    },
    // Old set augment — should be filtered out
    {
      apiName: 'TFT13_Augment_OldAugment',
      associatedTraits: [],
      composition: [],
      desc: 'Old augment from a previous set.',
      effects: {},
      from: null,
      icon: 'test.tex',
      id: null,
      incompatibleTraits: [],
      name: 'Old Augment',
      tags: [],
      unique: false,
    },
    // Non-set, non-base item — should be filtered out
    {
      apiName: 'TFT6_Merc_X_Fish',
      associatedTraits: [],
      composition: ['TFT6_Merc_X', 'TFT6_Merc_Fish'],
      desc: 'Old item.',
      effects: {},
      from: null,
      icon: 'test.tex',
      id: null,
      incompatibleTraits: [],
      name: 'Old Prize',
      tags: [],
      unique: false,
    },
  ];
}

function createMockRawData(): TftRawData {
  return {
    items: createMockItems(),
    setData: {},
    sets: {
      '14': {
        name: 'OldSet',
        champions: [],
        traits: [],
      },
      '16': createMockSetData(),
      '7': {
        name: 'AncientSet',
        champions: [],
        traits: [],
      },
    },
  };
}

// --- Tests ---

describe('Set detection', () => {
  it('picks the highest numbered set', () => {
    const data = createMockRawData();
    expect(detectCurrentSet(data)).toBe('16');
  });

  it('works with single set', () => {
    const data: TftRawData = {
      items: [],
      setData: {},
      sets: { '5': { name: 'Set5', champions: [], traits: [] } },
    };
    expect(detectCurrentSet(data)).toBe('5');
  });

  it('throws when no numeric sets exist', () => {
    const data: TftRawData = {
      items: [],
      setData: {},
      sets: {},
    };
    expect(() => detectCurrentSet(data)).toThrow('No numbered sets found');
  });

  it('getSetData throws for missing set', () => {
    const data = createMockRawData();
    expect(() => getSetData(data, '99')).toThrow('Set 99 not found');
  });
});

describe('Champion parsing', () => {
  it('extracts correct field values', () => {
    const setData = createMockSetData();
    const champions = parseChampions(setData);

    // Should filter out the special unit (no traits)
    expect(champions).toHaveLength(2);

    const champ = champions[0];
    expect(champ.name).toBe('Test Champion');
    expect(champ.apiName).toBe('TFT16_TestChampion');
    expect(champ.cost).toBe(3);
    expect(champ.role).toBe('damage');
  });

  it('maps stats correctly', () => {
    const setData = createMockSetData();
    const champions = parseChampions(setData);
    const champ = champions[0];

    expect(champ.hp).toBe(800);
    expect(champ.ad).toBe(60);
    expect(champ.armor).toBe(30);
    expect(champ.mr).toBe(30);
    expect(champ.attackSpeed).toBe(0.75);
    expect(champ.mana).toBe(80);
    expect(champ.initialMana).toBe(30);
    expect(champ.range).toBe(1);
    expect(champ.critChance).toBe(0.25);
    expect(champ.critMultiplier).toBe(1.4);
  });

  it('extracts traits array', () => {
    const setData = createMockSetData();
    const champions = parseChampions(setData);
    expect(champions[0].traits).toEqual(['Warrior', 'Bruiser']);
    expect(champions[1].traits).toEqual(['Healer']);
  });

  it('resolves ability description with variables', () => {
    const setData = createMockSetData();
    const champions = parseChampions(setData);
    const champ = champions[0];

    expect(champ.abilityName).toBe('Fireball');
    // Star-level scaling with leading 0 stripped: "100/150/200"
    expect(champ.abilityDesc).toContain('100/150/200');
    expect(champ.abilityDesc).toContain('50');
  });

  it('filters out non-playable units', () => {
    const setData = createMockSetData();
    const champions = parseChampions(setData);
    const names = champions.map(c => c.name);
    expect(names).not.toContain('Special Unit');
  });

  it('serializes ability variables as JSON', () => {
    const setData = createMockSetData();
    const champions = parseChampions(setData);
    const vars = JSON.parse(champions[0].abilityVariables);
    expect(Array.isArray(vars)).toBe(true);
    // Should filter out null entries
    expect(vars.every((v: { name: string }) => v.name !== null)).toBe(true);
  });
});

describe('Trait parsing', () => {
  it('extracts trait fields', () => {
    const setData = createMockSetData();
    const traits = parseTraits(setData);

    expect(traits).toHaveLength(2);
    expect(traits[0].name).toBe('Warrior');
    expect(traits[0].apiName).toBe('TFT16_Warrior');
  });

  it('extracts breakpoints correctly', () => {
    const setData = createMockSetData();
    const traits = parseTraits(setData);
    const warrior = traits[0];

    expect(warrior.breakpoints).toHaveLength(3);
    expect(warrior.breakpoints[0]).toEqual({
      minUnits: 2,
      maxUnits: 3,
      style: 1,
      variables: { BonusAD: 10 },
    });
    expect(warrior.breakpoints[2].minUnits).toBe(6);
  });

  it('resolves trait description', () => {
    const setData = createMockSetData();
    const traits = parseTraits(setData);
    const warrior = traits[0];

    // Should resolve @BonusAD@ from first breakpoint
    expect(warrior.description).toContain('10');
  });
});

describe('Item parsing', () => {
  it('identifies components by tag', () => {
    const items = createMockItems();
    const bfSword = items[0];
    expect(isComponent(bfSword)).toBe(true);
    expect(isAugment(bfSword)).toBe(false);
  });

  it('identifies augments by apiName', () => {
    const items = createMockItems();
    const augment = items[4]; // TFT16_Augment_WarriorCrown
    expect(isAugment(augment)).toBe(true);
    expect(isComponent(augment)).toBe(false);
  });

  it('separates items from augments', () => {
    const { items, augments } = parseItems(createMockItems(), '16');

    // Should include: BFSword, RecurveBow, GiantSlayer, ThiefsGloves
    // Should exclude: old set items (TFT6_Merc_X_Fish, TFT13_Augment_OldAugment)
    expect(items.length).toBe(4);
    expect(augments.length).toBe(1);
  });

  it('detects completed items via composition', () => {
    const { items } = parseItems(createMockItems(), '16');
    const giantSlayer = items.find(i => i.name === 'Giant Slayer');
    expect(giantSlayer).toBeDefined();

    const composition = JSON.parse(giantSlayer!.composition);
    expect(composition).toEqual(['TFT_Item_BFSword', 'TFT_Item_RecurveBow']);
    expect(giantSlayer!.isComponent).toBe(false);
  });

  it('marks components correctly', () => {
    const { items } = parseItems(createMockItems(), '16');
    const bfSword = items.find(i => i.name === 'B.F. Sword');
    expect(bfSword!.isComponent).toBe(true);
  });

  it('marks unique items', () => {
    const { items } = parseItems(createMockItems(), '16');
    const thiefs = items.find(i => i.name === "Thief's Gloves");
    expect(thiefs!.unique).toBe(true);

    const giantSlayer = items.find(i => i.name === 'Giant Slayer');
    expect(giantSlayer!.unique).toBe(false);
  });

  it('filters out items from other sets', () => {
    const { items, augments } = parseItems(createMockItems(), '16');
    const allApiNames = [...items.map(i => i.apiName), ...augments.map(a => a.apiName)];
    expect(allApiNames).not.toContain('TFT6_Merc_X_Fish');
    expect(allApiNames).not.toContain('TFT13_Augment_OldAugment');
  });
});

describe('Augment extraction', () => {
  it('extracts augment fields', () => {
    const { augments } = parseItems(createMockItems(), '16');
    expect(augments).toHaveLength(1);

    const aug = augments[0];
    expect(aug.name).toBe('Warrior Crown');
    expect(aug.apiName).toBe('TFT16_Augment_WarriorCrown');
    expect(aug.description).toContain('Warrior');
  });
});

describe('Description variable resolution', () => {
  it('resolves simple @Variable@ replacements', () => {
    const vars: RawVariable[] = [{ name: 'Damage', value: 100 }];
    expect(resolveDescription('Deals @Damage@ damage', vars)).toBe('Deals 100 damage');
  });

  it('resolves star-level scaling arrays', () => {
    const vars: RawVariable[] = [{ name: 'Damage', value: [0, 100, 150, 200] }];
    // Leading 0 stripped → "100/150/200"
    expect(resolveDescription('@Damage@ damage', vars)).toBe('100/150/200 damage');
  });

  it('resolves multiplier expressions like @Var*100@', () => {
    const vars: RawVariable[] = [{ name: 'Percent', value: 0.25 }];
    expect(resolveDescription('@Percent*100@% chance', vars)).toBe('25% chance');
  });

  it('strips %i:scaleXX% formatting tags', () => {
    const result = resolveDescription('Deals %i:scaleAD%50%i:scaleAD% damage', []);
    expect(result).toBe('Deals 50 damage');
  });

  it('strips HTML tags and converts <br> to newline', () => {
    const result = stripMarkup('Hello<br>World<physicalDamage>test</physicalDamage>');
    expect(result).toBe('Hello\nWorldtest');
  });

  it('handles empty description', () => {
    expect(resolveDescription('', [])).toBe('');
  });

  it('keeps unresolved variables if not in lookup', () => {
    const result = resolveDescription('@Unknown@ value', []);
    expect(result).toBe('@Unknown@ value');
  });

  it('is case-insensitive for variable lookup', () => {
    const vars: RawVariable[] = [{ name: 'TotalDamage', value: 50 }];
    expect(resolveDescription('@totaldamage@ hit', vars)).toBe('50 hit');
  });

  it('handles array without leading zero', () => {
    const vars: RawVariable[] = [{ name: 'Heal', value: [100, 200, 300] }];
    expect(resolveDescription('@Heal@', vars)).toBe('100/200/300');
  });
});

describe('Database initialization', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
  });

  it('creates all tables', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as Array<{ name: string }>;
    const names = tables.map(t => t.name);

    expect(names).toContain('champions');
    expect(names).toContain('traits');
    expect(names).toContain('champion_traits');
    expect(names).toContain('items');
    expect(names).toContain('augments');
    expect(names).toContain('metadata');
  });

  it('creates FTS virtual tables', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_fts%' ORDER BY name")
      .all() as Array<{ name: string }>;
    const names = tables.map(t => t.name);

    expect(names).toContain('champions_fts');
    expect(names).toContain('traits_fts');
    expect(names).toContain('items_fts');
    expect(names).toContain('augments_fts');
  });

  it('reports no existing data on fresh db', () => {
    expect(hasExistingData(db)).toBe(false);
  });

  it('gets and sets metadata', () => {
    expect(getMetadata(db, 'test_key')).toBeNull();
    setMetadata(db, 'test_key', 'test_value');
    expect(getMetadata(db, 'test_key')).toBe('test_value');
  });

  it('schema is idempotent', () => {
    // Running getDatabase again should not throw
    expect(() => getDatabase(':memory:')).not.toThrow();
  });
});

describe('Full pipeline with mock data', () => {
  let db: Database.Database;
  let tmpCacheDir: string;

  // Create a mock fetch that returns our mock data
  function createMockFetch(): typeof fetch {
    const mockData = createMockRawData();
    return (async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'Last-Modified': 'Thu, 01 Jan 2026 00:00:00 GMT' }),
      text: async () => JSON.stringify(mockData),
      json: async () => mockData,
    })) as unknown as typeof fetch;
  }

  beforeEach(() => {
    db = getDatabase(':memory:');
    tmpCacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tft-oracle-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpCacheDir, { recursive: true, force: true });
  });

  it('ingests all data types', async () => {
    const result = await runPipeline(db, {
      force: true,
      fetchFn: createMockFetch(),
      cacheDir: tmpCacheDir,
    });

    expect(result.champions).toBe(2); // Filtered out special unit
    expect(result.traits).toBe(2);
    expect(result.items).toBe(4); // BFSword, RecurveBow, GiantSlayer, ThiefsGloves
    expect(result.augments).toBe(1); // WarriorCrown only (old set filtered)
    expect(result.setNumber).toBe('16');
    expect(result.setName).toBe('TestSet');
  });

  it('stores metadata after ingestion', async () => {
    await runPipeline(db, { force: true, fetchFn: createMockFetch(), cacheDir: tmpCacheDir });

    expect(getMetadata(db, 'set_number')).toBe('16');
    expect(getMetadata(db, 'set_name')).toBe('TestSet');
    expect(getMetadata(db, 'last_updated')).toBeTruthy();
  });

  it('populates champion_traits junction', async () => {
    await runPipeline(db, { force: true, fetchFn: createMockFetch(), cacheDir: tmpCacheDir });

    const rows = db.prepare('SELECT * FROM champion_traits ORDER BY champion_name, trait_name').all() as Array<{
      champion_name: string;
      trait_name: string;
    }>;

    expect(rows).toHaveLength(3); // Test Champion: 2 traits, Test Support: 1 trait
    expect(rows[0]).toEqual({ champion_name: 'Test Champion', trait_name: 'Bruiser' });
    expect(rows[1]).toEqual({ champion_name: 'Test Champion', trait_name: 'Warrior' });
    expect(rows[2]).toEqual({ champion_name: 'Test Support', trait_name: 'Healer' });
  });

  it('FTS search works after ingestion', async () => {
    await runPipeline(db, { force: true, fetchFn: createMockFetch(), cacheDir: tmpCacheDir });

    const results = db
      .prepare("SELECT name FROM champions_fts WHERE champions_fts MATCH 'Fireball'")
      .all() as Array<{ name: string }>;

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Test Champion');
  });

  it('skips fetch when data exists and not forced', async () => {
    // First run
    await runPipeline(db, { force: true, fetchFn: createMockFetch(), cacheDir: tmpCacheDir });

    // Second run without force — should skip
    let fetchCalled = false;
    const trackingFetch = (async () => {
      fetchCalled = true;
      return { ok: true, status: 200, text: async () => '{}', json: async () => ({}) };
    }) as unknown as typeof fetch;

    await runPipeline(db, { fetchFn: trackingFetch, cacheDir: tmpCacheDir });
    expect(fetchCalled).toBe(false);
  });

  it('clears existing data before re-ingestion', async () => {
    // First run
    await runPipeline(db, { force: true, fetchFn: createMockFetch(), cacheDir: tmpCacheDir });

    // Force second run
    await runPipeline(db, { force: true, fetchFn: createMockFetch(), cacheDir: tmpCacheDir });

    // Should not have duplicates
    const count = (db.prepare('SELECT COUNT(*) as cnt FROM champions').get() as { cnt: number }).cnt;
    expect(count).toBe(2);
  });

  it('items are queryable by component status', async () => {
    await runPipeline(db, { force: true, fetchFn: createMockFetch(), cacheDir: tmpCacheDir });

    const components = db.prepare('SELECT name FROM items WHERE isComponent = 1 ORDER BY name').all() as Array<{ name: string }>;
    expect(components.map(c => c.name)).toEqual(['B.F. Sword', 'Recurve Bow']);

    const completed = db.prepare('SELECT name FROM items WHERE isComponent = 0 ORDER BY name').all() as Array<{ name: string }>;
    expect(completed.map(c => c.name)).toEqual(['Giant Slayer', "Thief's Gloves"]);
  });
});
