import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

// --- Constants ---

const DEFAULT_DATA_DIR = path.join(os.homedir(), '.tft-oracle');
const DB_FILENAME = 'tft.sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// --- Schema loading ---

function loadSchema(): string {
  return fs.readFileSync(SCHEMA_PATH, 'utf-8');
}

// --- Directory management ---

function ensureDataDir(dataDir: string): void {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// --- Database management ---

/**
 * Opens (or creates) a SQLite database and initializes the schema.
 *
 * @param dataDir - Custom data directory. Defaults to ~/.tft-oracle/.
 *                  Pass ':memory:' for an in-memory database (tests).
 * @returns A better-sqlite3 Database instance with schema applied.
 */
export function getDatabase(dataDir?: string): Database.Database {
  let db: Database.Database;

  if (dataDir === ':memory:') {
    db = new Database(':memory:');
  } else {
    const dir = dataDir ?? DEFAULT_DATA_DIR;
    ensureDataDir(dir);
    const dbPath = path.join(dir, DB_FILENAME);
    db = new Database(dbPath);
  }

  // Performance pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Initialize schema (idempotent via IF NOT EXISTS)
  initializeSchema(db);

  return db;
}

/**
 * Runs the schema SQL against the database.
 * Safe to call multiple times due to IF NOT EXISTS clauses.
 */
function initializeSchema(db: Database.Database): void {
  let schema: string;
  try {
    schema = loadSchema();
  } catch {
    throw new Error(
      `Could not load schema.sql from ${SCHEMA_PATH}. ` +
      'Ensure schema.sql is copied to the dist/data/ directory during build.'
    );
  }
  db.exec(schema);
}

/**
 * Check if the champions table has any rows.
 */
export function hasExistingData(db: Database.Database): boolean {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM champions').get() as { cnt: number };
  return row.cnt > 0;
}

/**
 * Get metadata value by key.
 */
export function getMetadata(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM metadata WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

/**
 * Set metadata value.
 */
export function setMetadata(db: Database.Database, key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)').run(key, value);
}
