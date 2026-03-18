import { describe, it, expect, beforeEach } from 'vitest';
import { getDatabase } from '../src/data/db.js';
import { searchTraits } from '../src/tools/search-traits.js';
import { getTrait } from '../src/tools/get-trait.js';
import type Database from 'better-sqlite3';

// --- Mock data helpers ---

function insertMockData(db: Database.Database): void {
  // Traits
  db.prepare(
    `INSERT INTO traits (name, apiName, description, breakpoints) VALUES (?, ?, ?, ?)`,
  ).run(
    'Warrior',
    'TFT16_Warrior',
    'Warriors gain bonus Attack Damage.',
    JSON.stringify([
      { minUnits: 2, maxUnits: 3, style: 1, variables: { BonusAD: 10 } },
      { minUnits: 4, maxUnits: 6, style: 2, variables: { BonusAD: 30 } },
      { minUnits: 6, maxUnits: 25000, style: 3, variables: { BonusAD: 60 } },
    ]),
  );

  db.prepare(
    `INSERT INTO traits (name, apiName, description, breakpoints) VALUES (?, ?, ?, ?)`,
  ).run(
    'Healer',
    'TFT16_Healer',
    'Healers restore a percentage of max Health to allies each second.',
    JSON.stringify([
      { minUnits: 2, maxUnits: 4, style: 1, variables: { HealPercent: 15 } },
      { minUnits: 4, maxUnits: 25000, style: 2, variables: { HealPercent: 30 } },
    ]),
  );

  db.prepare(
    `INSERT INTO traits (name, apiName, description, breakpoints) VALUES (?, ?, ?, ?)`,
  ).run(
    'Bruiser',
    'TFT16_Bruiser',
    'Bruisers gain bonus max Health. This is a very long description that should be truncated when shown in search results because it exceeds one hundred characters easily.',
    JSON.stringify([
      { minUnits: 2, maxUnits: 3, style: 1, variables: { BonusHP: 200 } },
    ]),
  );

  // Champions
  db.prepare(
    `INSERT INTO champions (name, apiName, cost, role, hp, ad, armor, mr, attackSpeed, mana, initialMana, range, critChance, critMultiplier, abilityName, abilityDesc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run('Garen', 'TFT16_Garen', 1, 'tank', 700, 50, 35, 20, 0.6, 80, 30, 1, 0.25, 1.4, 'Spin', 'Spins and deals damage.');

  db.prepare(
    `INSERT INTO champions (name, apiName, cost, role, hp, ad, armor, mr, attackSpeed, mana, initialMana, range, critChance, critMultiplier, abilityName, abilityDesc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run('Darius', 'TFT16_Darius', 3, 'damage', 850, 70, 40, 25, 0.7, 90, 20, 1, 0.25, 1.4, 'Slash', 'Slashes enemies.');

  db.prepare(
    `INSERT INTO champions (name, apiName, cost, role, hp, ad, armor, mr, attackSpeed, mana, initialMana, range, critChance, critMultiplier, abilityName, abilityDesc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run('Soraka', 'TFT16_Soraka', 4, 'support', 600, 40, 20, 30, 0.65, 60, 40, 3, 0.25, 1.4, 'Wish', 'Heals all allies.');

  db.prepare(
    `INSERT INTO champions (name, apiName, cost, role, hp, ad, armor, mr, attackSpeed, mana, initialMana, range, critChance, critMultiplier, abilityName, abilityDesc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run('Vi', 'TFT16_Vi', 2, 'tank', 750, 55, 35, 20, 0.65, 80, 30, 1, 0.25, 1.4, 'Punch', 'Punches hard.');

  // Champion-Trait links
  const insertLink = db.prepare(
    `INSERT INTO champion_traits (champion_name, trait_name) VALUES (?, ?)`,
  );
  insertLink.run('Garen', 'Warrior');
  insertLink.run('Garen', 'Bruiser');
  insertLink.run('Darius', 'Warrior');
  insertLink.run('Soraka', 'Healer');
  insertLink.run('Vi', 'Bruiser');
  insertLink.run('Vi', 'Warrior');
}

// --- Tests ---

describe('searchTraits', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    insertMockData(db);
  });

  it('searches traits by text query', () => {
    const result = searchTraits(db, { query: 'Attack Damage' });
    expect(result.traits.length).toBeGreaterThanOrEqual(1);
    expect(result.traits.some((t) => t.name === 'Warrior')).toBe(true);
  });

  it('lists all traits when query is empty', () => {
    const result = searchTraits(db, {});
    expect(result.traits).toHaveLength(3);
    // Should be ordered by name
    expect(result.traits[0].name).toBe('Bruiser');
    expect(result.traits[1].name).toBe('Healer');
    expect(result.traits[2].name).toBe('Warrior');
  });

  it('truncates descriptions to 100 chars', () => {
    const result = searchTraits(db, {});
    const bruiser = result.traits.find((t) => t.name === 'Bruiser');
    expect(bruiser).toBeDefined();
    // 100 chars + '...' = 103
    expect(bruiser!.description.length).toBeLessThanOrEqual(103);
    expect(bruiser!.description).toMatch(/\.\.\.$/);
  });

  it('returns correct breakpoint count', () => {
    const result = searchTraits(db, {});
    const warrior = result.traits.find((t) => t.name === 'Warrior');
    expect(warrior!.breakpointCount).toBe(3);

    const bruiser = result.traits.find((t) => t.name === 'Bruiser');
    expect(bruiser!.breakpointCount).toBe(1);
  });

  it('respects limit parameter', () => {
    const result = searchTraits(db, { limit: 2 });
    expect(result.traits).toHaveLength(2);
  });
});

describe('getTrait', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    insertMockData(db);
  });

  it('finds a trait by exact name (case-insensitive)', () => {
    const result = getTrait(db, { name: 'warrior' });
    expect(result.found).toBe(true);
    if (!result.found) return;
    expect(result.trait.name).toBe('Warrior');
  });

  it('returns full description', () => {
    const result = getTrait(db, { name: 'Warrior' });
    expect(result.found).toBe(true);
    if (!result.found) return;
    expect(result.trait.description).toBe('Warriors gain bonus Attack Damage.');
  });

  it('returns parsed breakpoints', () => {
    const result = getTrait(db, { name: 'Warrior' });
    expect(result.found).toBe(true);
    if (!result.found) return;

    expect(result.trait.breakpoints).toHaveLength(3);
    expect(result.trait.breakpoints[0]).toEqual({
      minUnits: 2,
      maxUnits: 3,
      style: 1,
      variables: { BonusAD: 10 },
    });
    expect(result.trait.breakpoints[2].minUnits).toBe(6);
  });

  it('returns champions sorted by cost', () => {
    const result = getTrait(db, { name: 'Warrior' });
    expect(result.found).toBe(true);
    if (!result.found) return;

    const champs = result.trait.champions;
    expect(champs).toHaveLength(3);
    // Garen (1), Vi (2), Darius (3) — sorted by cost ascending
    expect(champs[0]).toEqual({ name: 'Garen', cost: 1 });
    expect(champs[1]).toEqual({ name: 'Vi', cost: 2 });
    expect(champs[2]).toEqual({ name: 'Darius', cost: 3 });
  });

  it('falls back to FTS5 when no exact match', () => {
    const result = getTrait(db, { name: 'Heal' });
    expect(result.found).toBe(true);
    if (!result.found) return;
    expect(result.trait.name).toBe('Healer');
  });

  it('returns not found with suggestions for unknown trait', () => {
    const result = getTrait(db, { name: 'Heal Master' });
    expect(result.found).toBe(false);
    if (result.found) return;
    expect(result.message).toContain('Heal Master');
    expect(result.suggestions).toBeDefined();
    expect(result.suggestions).toContain('Healer');
  });

  it('returns not found with no suggestions for completely unknown trait', () => {
    const result = getTrait(db, { name: 'Zzzzzzzz' });
    expect(result.found).toBe(false);
    if (result.found) return;
    expect(result.suggestions).toBeUndefined();
  });
});
