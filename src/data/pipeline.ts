import type Database from 'better-sqlite3';
import { hasExistingData, setMetadata } from './db.js';
import { fetchTftData } from './fetch.js';
import {
  detectCurrentSet,
  getSetData,
  parseChampions,
  parseTraits,
  parseItems,
} from './parser.js';
import type { Champion, Trait, Item, Augment } from './types.js';

// --- Constants ---

const BATCH_SIZE = 500;

// --- Types ---

export interface PipelineOptions {
  force?: boolean;
  cacheDir?: string;
  fetchFn?: typeof fetch;
}

export interface PipelineResult {
  champions: number;
  traits: number;
  items: number;
  augments: number;
  setNumber: string;
  setName: string;
}

// --- Insertion helpers ---

function insertChampions(db: Database.Database, champions: Champion[]): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO champions
    (name, apiName, cost, role, hp, ad, armor, mr, attackSpeed,
     mana, initialMana, range, critChance, critMultiplier,
     abilityName, abilityDesc, abilityVariables)
    VALUES
    (@name, @apiName, @cost, @role, @hp, @ad, @armor, @mr, @attackSpeed,
     @mana, @initialMana, @range, @critChance, @critMultiplier,
     @abilityName, @abilityDesc, @abilityVariables)
  `);

  const traitStmt = db.prepare(`
    INSERT OR REPLACE INTO champion_traits (champion_name, trait_name)
    VALUES (?, ?)
  `);

  for (let i = 0; i < champions.length; i += BATCH_SIZE) {
    const batch = champions.slice(i, i + BATCH_SIZE);
    const transaction = db.transaction((rows: Champion[]) => {
      for (const champ of rows) {
        stmt.run({
          name: champ.name,
          apiName: champ.apiName,
          cost: champ.cost,
          role: champ.role,
          hp: champ.hp,
          ad: champ.ad,
          armor: champ.armor,
          mr: champ.mr,
          attackSpeed: champ.attackSpeed,
          mana: champ.mana,
          initialMana: champ.initialMana,
          range: champ.range,
          critChance: champ.critChance,
          critMultiplier: champ.critMultiplier,
          abilityName: champ.abilityName,
          abilityDesc: champ.abilityDesc,
          abilityVariables: champ.abilityVariables,
        });
        for (const trait of champ.traits) {
          traitStmt.run(champ.name, trait);
        }
      }
    });
    transaction(batch);
  }
}

function insertTraits(db: Database.Database, traits: Trait[]): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO traits (name, apiName, description, breakpoints)
    VALUES (@name, @apiName, @description, @breakpoints)
  `);

  const transaction = db.transaction((rows: Trait[]) => {
    for (const trait of rows) {
      stmt.run({
        name: trait.name,
        apiName: trait.apiName,
        description: trait.description,
        breakpoints: JSON.stringify(trait.breakpoints),
      });
    }
  });
  transaction(traits);
}

function insertItems(db: Database.Database, items: Item[]): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO items
    (name, apiName, description, effects, composition, tags, isComponent, unique_)
    VALUES
    (@name, @apiName, @description, @effects, @composition, @tags, @isComponent, @unique_)
  `);

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const transaction = db.transaction((rows: Item[]) => {
      for (const item of rows) {
        stmt.run({
          name: item.name,
          apiName: item.apiName,
          description: item.description,
          effects: item.effects,
          composition: item.composition,
          tags: item.tags,
          isComponent: item.isComponent ? 1 : 0,
          unique_: item.unique ? 1 : 0,
        });
      }
    });
    transaction(batch);
  }
}

function insertAugments(db: Database.Database, augments: Augment[]): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO augments (name, apiName, description, effects)
    VALUES (@name, @apiName, @description, @effects)
  `);

  for (let i = 0; i < augments.length; i += BATCH_SIZE) {
    const batch = augments.slice(i, i + BATCH_SIZE);
    const transaction = db.transaction((rows: Augment[]) => {
      for (const aug of rows) {
        stmt.run({
          name: aug.name,
          apiName: aug.apiName,
          description: aug.description,
          effects: aug.effects,
        });
      }
    });
    transaction(batch);
  }
}

/**
 * Clear all data tables (but not the schema).
 * FTS tables are cleared automatically via triggers.
 */
function clearAllData(db: Database.Database): void {
  db.exec('DELETE FROM champion_traits');
  db.exec('DELETE FROM champions');
  db.exec('DELETE FROM traits');
  db.exec('DELETE FROM items');
  db.exec('DELETE FROM augments');
  db.exec('DELETE FROM metadata');
}

// --- Pipeline ---

/**
 * Run the full data pipeline: fetch → parse → ingest.
 *
 * 1. Fetch data from CommunityDragon (with caching)
 * 2. Detect current set
 * 3. Parse champions, traits, items, augments
 * 4. Clear existing data
 * 5. Insert all data into SQLite
 * 6. Store metadata
 *
 * @returns Pipeline result with counts of ingested entities
 */
export async function runPipeline(
  db: Database.Database,
  options?: PipelineOptions
): Promise<PipelineResult> {
  const cacheDir = options?.cacheDir;
  const force = options?.force ?? false;
  const fetchFn = options?.fetchFn;

  // Check if we already have data and aren't forcing refresh
  if (!force && hasExistingData(db)) {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM champions').get() as { cnt: number };
    console.error(
      `Skipping fetch — ${row.cnt} champions already loaded`
    );
    const setNumber = db.prepare("SELECT value FROM metadata WHERE key = 'set_number'").get() as { value: string } | undefined;
    const setName = db.prepare("SELECT value FROM metadata WHERE key = 'set_name'").get() as { value: string } | undefined;
    return {
      champions: row.cnt,
      traits: (db.prepare('SELECT COUNT(*) as cnt FROM traits').get() as { cnt: number }).cnt,
      items: (db.prepare('SELECT COUNT(*) as cnt FROM items').get() as { cnt: number }).cnt,
      augments: (db.prepare('SELECT COUNT(*) as cnt FROM augments').get() as { cnt: number }).cnt,
      setNumber: setNumber?.value ?? 'unknown',
      setName: setName?.value ?? 'unknown',
    };
  }

  try {
    // Fetch
    const rawData = await fetchTftData(cacheDir, fetchFn);

    // Detect current set
    const setNumber = detectCurrentSet(rawData);
    const setData = getSetData(rawData, setNumber);
    console.error(`Detected current set: ${setNumber} (${setData.name})`);

    // Parse
    const champions = parseChampions(setData);
    const traits = parseTraits(setData);
    const { items, augments } = parseItems(rawData.items, setNumber);

    // Clear and re-ingest
    clearAllData(db);

    insertChampions(db, champions);
    insertTraits(db, traits);
    insertItems(db, items);
    insertAugments(db, augments);

    // Store metadata
    setMetadata(db, 'last_updated', new Date().toISOString());
    setMetadata(db, 'set_number', setNumber);
    setMetadata(db, 'set_name', setData.name);
    setMetadata(db, 'data_version', `cdragon-${setNumber}`);

    const result: PipelineResult = {
      champions: champions.length,
      traits: traits.length,
      items: items.length,
      augments: augments.length,
      setNumber,
      setName: setData.name,
    };

    console.error(
      `Pipeline complete: ${result.champions} champions, ${result.traits} traits, ` +
      `${result.items} items, ${result.augments} augments (Set ${setNumber}: ${setData.name})`
    );

    return result;
  } catch (error) {
    if (!hasExistingData(db)) {
      throw error;
    }

    console.error(
      `Failed to fetch TFT data, using cached data: ${error instanceof Error ? error.message : String(error)}`
    );

    return {
      champions: (db.prepare('SELECT COUNT(*) as cnt FROM champions').get() as { cnt: number }).cnt,
      traits: (db.prepare('SELECT COUNT(*) as cnt FROM traits').get() as { cnt: number }).cnt,
      items: (db.prepare('SELECT COUNT(*) as cnt FROM items').get() as { cnt: number }).cnt,
      augments: (db.prepare('SELECT COUNT(*) as cnt FROM augments').get() as { cnt: number }).cnt,
      setNumber: 'cached',
      setName: 'cached',
    };
  }
}
