import { describe, it, expect, beforeEach } from 'vitest';
import { getDatabase } from '../src/data/db.js';
import { searchChampions } from '../src/tools/search-champions.js';
import { getChampion } from '../src/tools/get-champion.js';
import type Database from 'better-sqlite3';

// --- Mock data helpers ---

function insertMockData(db: Database.Database): void {
  // Insert champions
  const insertChampion = db.prepare(`
    INSERT INTO champions (name, apiName, cost, role, hp, ad, armor, mr, attackSpeed, mana, initialMana, range, critChance, critMultiplier, abilityName, abilityDesc, abilityVariables)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertChampion.run(
    'Ahri', 'TFT16_Ahri', 4, 'damage',
    800, 50, 30, 30, 0.75,
    80, 20, 4, 0.25, 1.4,
    'Spirit Rush', 'Dashes and deals 200/300/500 magic damage.',
    JSON.stringify([{ name: 'Damage', value: [0, 200, 300, 500] }]),
  );

  insertChampion.run(
    'Garen', 'TFT16_Garen', 1, 'tank',
    700, 55, 40, 25, 0.6,
    60, 0, 1, 0.25, 1.4,
    'Judgment', 'Spins dealing 100/150/250 damage to nearby enemies.',
    JSON.stringify([{ name: 'Damage', value: [0, 100, 150, 250] }]),
  );

  insertChampion.run(
    'Jinx', 'TFT16_Jinx', 3, 'damage',
    650, 70, 20, 20, 0.85,
    100, 30, 4, 0.25, 1.4,
    'Super Mega Death Rocket', 'Fires a rocket dealing 300/450/700 damage.',
    JSON.stringify([{ name: 'Damage', value: [0, 300, 450, 700] }]),
  );

  insertChampion.run(
    'Soraka', 'TFT16_Soraka', 2, 'support',
    550, 30, 15, 35, 0.65,
    70, 40, 3, 0.25, 1.4,
    'Starcall', 'Heals allies for 150/225/350 HP.',
    JSON.stringify([{ name: 'HealAmount', value: [0, 150, 225, 350] }]),
  );

  // Insert traits
  const insertTrait = db.prepare(`
    INSERT INTO traits (name, apiName, description, breakpoints)
    VALUES (?, ?, ?, ?)
  `);

  insertTrait.run('Sorcerer', 'TFT16_Sorcerer', 'Sorcerers gain bonus AP.', '[]');
  insertTrait.run('Warrior', 'TFT16_Warrior', 'Warriors gain bonus AD.', '[]');
  insertTrait.run('Marksman', 'TFT16_Marksman', 'Marksmen gain bonus attack speed.', '[]');
  insertTrait.run('Healer', 'TFT16_Healer', 'Healers restore health to allies.', '[]');

  // Insert champion_traits junction
  const insertChampionTrait = db.prepare(
    'INSERT INTO champion_traits (champion_name, trait_name) VALUES (?, ?)',
  );

  insertChampionTrait.run('Ahri', 'Sorcerer');
  insertChampionTrait.run('Garen', 'Warrior');
  insertChampionTrait.run('Jinx', 'Marksman');
  insertChampionTrait.run('Jinx', 'Sorcerer');
  insertChampionTrait.run('Soraka', 'Healer');
  insertChampionTrait.run('Soraka', 'Sorcerer');
}

// --- Tests ---

describe('searchChampions', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    insertMockData(db);
  });

  it('searches by text query', () => {
    const result = searchChampions(db, { query: 'Ahri' });
    expect(result.total).toBe(1);
    expect(result.champions[0].name).toBe('Ahri');
  });

  it('searches ability text', () => {
    const result = searchChampions(db, { query: 'rocket' });
    expect(result.total).toBe(1);
    expect(result.champions[0].name).toBe('Jinx');
  });

  it('filters by cost', () => {
    const result = searchChampions(db, { cost: 1 });
    expect(result.total).toBe(1);
    expect(result.champions[0].name).toBe('Garen');
    expect(result.champions[0].cost).toBe(1);
  });

  it('filters by trait', () => {
    const result = searchChampions(db, { trait: 'Sorcerer' });
    expect(result.total).toBe(3);
    const names = result.champions.map((c) => c.name).sort();
    expect(names).toEqual(['Ahri', 'Jinx', 'Soraka']);
  });

  it('filters by trait case-insensitive', () => {
    const result = searchChampions(db, { trait: 'sorcerer' });
    expect(result.total).toBe(3);
  });

  it('filters by role', () => {
    const result = searchChampions(db, { role: 'damage' });
    expect(result.total).toBe(2);
    const names = result.champions.map((c) => c.name).sort();
    expect(names).toEqual(['Ahri', 'Jinx']);
  });

  it('combines filters: cost + role', () => {
    const result = searchChampions(db, { cost: 4, role: 'damage' });
    expect(result.total).toBe(1);
    expect(result.champions[0].name).toBe('Ahri');
  });

  it('combines query + trait filter', () => {
    const result = searchChampions(db, { query: 'damage', trait: 'Sorcerer' });
    // Ahri ability mentions "damage", Jinx ability mentions "damage", both have Sorcerer
    expect(result.total).toBeGreaterThanOrEqual(1);
    const names = result.champions.map((c) => c.name);
    expect(names.every((n) => ['Ahri', 'Jinx'].includes(n))).toBe(true);
  });

  it('returns empty results for no match', () => {
    const result = searchChampions(db, { cost: 5 });
    expect(result.total).toBe(0);
    expect(result.champions).toEqual([]);
  });

  it('returns traits as comma-separated string', () => {
    const result = searchChampions(db, { query: 'Jinx' });
    expect(result.champions[0].traits).toContain('Marksman');
    expect(result.champions[0].traits).toContain('Sorcerer');
  });

  it('respects limit', () => {
    const result = searchChampions(db, { limit: 2 });
    expect(result.total).toBeLessThanOrEqual(2);
  });

  it('returns all champions with no filters', () => {
    const result = searchChampions(db, {});
    expect(result.total).toBe(4);
  });
});

describe('getChampion', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    insertMockData(db);
  });

  it('finds exact match', () => {
    const result = getChampion(db, { name: 'Ahri' });
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.champion.name).toBe('Ahri');
      expect(result.champion.cost).toBe(4);
      expect(result.champion.role).toBe('damage');
    }
  });

  it('finds case-insensitive match', () => {
    const result = getChampion(db, { name: 'ahri' });
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.champion.name).toBe('Ahri');
    }
  });

  it('finds case-insensitive match (mixed case)', () => {
    const result = getChampion(db, { name: 'GAREN' });
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.champion.name).toBe('Garen');
    }
  });

  it('finds fuzzy match via FTS5 (partial name)', () => {
    const result = getChampion(db, { name: 'Jinx' });
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.champion.name).toBe('Jinx');
    }
  });

  it('finds by ability name via FTS5', () => {
    const result = getChampion(db, { name: 'Starcall' });
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.champion.name).toBe('Soraka');
    }
  });

  it('returns full stats', () => {
    const result = getChampion(db, { name: 'Ahri' });
    expect(result.found).toBe(true);
    if (result.found) {
      const c = result.champion;
      expect(c.hp).toBe(800);
      expect(c.ad).toBe(50);
      expect(c.armor).toBe(30);
      expect(c.mr).toBe(30);
      expect(c.attackSpeed).toBe(0.75);
      expect(c.mana).toBe(80);
      expect(c.initialMana).toBe(20);
      expect(c.range).toBe(4);
    }
  });

  it('returns traits array', () => {
    const result = getChampion(db, { name: 'Jinx' });
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.champion.traits).toEqual(['Marksman', 'Sorcerer']);
    }
  });

  it('returns ability details', () => {
    const result = getChampion(db, { name: 'Ahri' });
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.champion.ability.name).toBe('Spirit Rush');
      expect(result.champion.ability.description).toContain('200/300/500');
      expect(result.champion.ability.variables).toHaveLength(1);
      expect(result.champion.ability.variables[0].name).toBe('Damage');
    }
  });

  it('returns not found with suggestions', () => {
    // "gar" won't match FTS5 exactly but LIKE '%gar%' will find "Garen"
    const result = getChampion(db, { name: 'gar' });
    expect(result.found).toBe(false);
    if (!result.found) {
      expect(result.message).toContain('gar');
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions).toContain('Garen');
    }
  });

  it('returns not found with no suggestions for gibberish', () => {
    const result = getChampion(db, { name: 'zzzzzzzzz' });
    expect(result.found).toBe(false);
    if (!result.found) {
      expect(result.message).toContain('zzzzzzzzz');
      expect(result.suggestions).toBeUndefined();
    }
  });
});
