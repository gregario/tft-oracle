import { describe, it, expect, beforeEach } from 'vitest';
import { getDatabase } from '../src/data/db.js';
import { searchAugments } from '../src/tools/search-augments.js';
import { getRollingOdds } from '../src/tools/get-rolling-odds.js';
import type Database from 'better-sqlite3';

// --- Helpers ---

function insertMockAugments(db: Database.Database): void {
  const stmt = db.prepare(
    'INSERT INTO augments (name, apiName, description, effects) VALUES (?, ?, ?, ?)',
  );
  stmt.run('Warrior Crown', 'TFT16_Augment_WarriorCrown', 'Gain the Warrior trait and a Warrior emblem.', '{}');
  stmt.run('Cybernetic Implants', 'TFT16_Augment_CyberneticImplants', 'Your champions with an item gain bonus health and attack damage.', '{}');
  stmt.run('First Aid Kit', 'TFT16_Augment_FirstAidKit', 'All allies heal a percentage of their max health every 5 seconds.', '{}');
}

// --- Search Augments Tests ---

describe('searchAugments', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    insertMockAugments(db);
  });

  it('searches augments by name', () => {
    const result = searchAugments(db, { query: 'Warrior' });
    expect(result.augments.length).toBeGreaterThanOrEqual(1);
    expect(result.augments[0].name).toBe('Warrior Crown');
  });

  it('searches augments by keyword in description', () => {
    const result = searchAugments(db, { query: 'heal' });
    expect(result.augments.length).toBeGreaterThanOrEqual(1);
    const names = result.augments.map((a) => a.name);
    expect(names).toContain('First Aid Kit');
  });

  it('lists all augments when query is empty', () => {
    const result = searchAugments(db, {});
    expect(result.augments).toHaveLength(3);
    expect(result.total).toBe(3);
  });

  it('returns empty results for no match', () => {
    const result = searchAugments(db, { query: 'nonexistentkeyword' });
    expect(result.augments).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// --- Rolling Odds Tests ---

describe('getRollingOdds', () => {
  it('returns odds for a specific level', () => {
    const result = getRollingOdds({ level: 7 });
    expect('levels' in result).toBe(true);
    if ('levels' in result) {
      expect(result.levels).toHaveLength(1);
      expect(result.levels[0].level).toBe(7);
      expect(result.levels[0].odds['1-cost']).toBe(19);
      expect(result.levels[0].odds['5-cost']).toBe(1);
    }
  });

  it('returns full table when no level specified', () => {
    const result = getRollingOdds({});
    expect('levels' in result).toBe(true);
    if ('levels' in result) {
      expect(result.levels).toHaveLength(9); // Levels 2-10
      expect(result.levels[0].level).toBe(2);
      expect(result.levels[8].level).toBe(10);
    }
  });

  it('returns error for invalid level 0', () => {
    // Zod would catch this at the schema level, but the function should handle it defensively
    const result = getRollingOdds({ level: 0 } as Parameters<typeof getRollingOdds>[0]);
    expect('error' in result).toBe(true);
  });

  it('returns error for invalid level 11', () => {
    const result = getRollingOdds({ level: 11 } as Parameters<typeof getRollingOdds>[0]);
    expect('error' in result).toBe(true);
  });

  it('returns error for invalid level 1', () => {
    const result = getRollingOdds({ level: 1 } as Parameters<typeof getRollingOdds>[0]);
    expect('error' in result).toBe(true);
  });

  it('odds sum to 100% for each level', () => {
    const result = getRollingOdds({});
    expect('levels' in result).toBe(true);
    if ('levels' in result) {
      for (const entry of result.levels) {
        const sum = Object.values(entry.odds).reduce((acc, val) => acc + val, 0);
        expect(sum).toBe(100);
      }
    }
  });
});
