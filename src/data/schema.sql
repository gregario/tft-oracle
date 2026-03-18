-- TFT Oracle database schema

-- Champions
CREATE TABLE IF NOT EXISTS champions (
  name TEXT NOT NULL,
  apiName TEXT PRIMARY KEY,
  cost INTEGER NOT NULL,
  role TEXT,
  hp REAL,
  ad REAL,
  armor REAL,
  mr REAL,
  attackSpeed REAL,
  mana INTEGER NOT NULL,
  initialMana INTEGER NOT NULL,
  range INTEGER NOT NULL,
  critChance REAL,
  critMultiplier REAL,
  abilityName TEXT,
  abilityDesc TEXT,
  abilityVariables TEXT          -- JSON array of {name, value}
);

-- Traits
CREATE TABLE IF NOT EXISTS traits (
  name TEXT NOT NULL,
  apiName TEXT PRIMARY KEY,
  description TEXT,
  breakpoints TEXT               -- JSON array of {minUnits, maxUnits, style, variables}
);

-- Champion-Trait junction
CREATE TABLE IF NOT EXISTS champion_traits (
  champion_name TEXT NOT NULL,
  trait_name TEXT NOT NULL,
  PRIMARY KEY (champion_name, trait_name)
);

-- Items (base components + completed items)
CREATE TABLE IF NOT EXISTS items (
  name TEXT NOT NULL,
  apiName TEXT PRIMARY KEY,
  description TEXT,
  effects TEXT,                  -- JSON object
  composition TEXT,              -- JSON array of component apiNames
  tags TEXT,                     -- comma-separated tags
  isComponent INTEGER DEFAULT 0,
  unique_ INTEGER DEFAULT 0
);

-- Augments
CREATE TABLE IF NOT EXISTS augments (
  name TEXT NOT NULL,
  apiName TEXT PRIMARY KEY,
  description TEXT,
  effects TEXT                   -- JSON object
);

-- Metadata (key-value store)
CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- FTS5 full-text search indexes

CREATE VIRTUAL TABLE IF NOT EXISTS champions_fts USING fts5(
  name, abilityName, abilityDesc,
  content='champions', content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS champions_ai AFTER INSERT ON champions BEGIN
  INSERT INTO champions_fts(rowid, name, abilityName, abilityDesc)
  VALUES (new.rowid, new.name, new.abilityName, new.abilityDesc);
END;
CREATE TRIGGER IF NOT EXISTS champions_ad AFTER DELETE ON champions BEGIN
  INSERT INTO champions_fts(champions_fts, rowid, name, abilityName, abilityDesc)
  VALUES ('delete', old.rowid, old.name, old.abilityName, old.abilityDesc);
END;
CREATE TRIGGER IF NOT EXISTS champions_au AFTER UPDATE ON champions BEGIN
  INSERT INTO champions_fts(champions_fts, rowid, name, abilityName, abilityDesc)
  VALUES ('delete', old.rowid, old.name, old.abilityName, old.abilityDesc);
  INSERT INTO champions_fts(rowid, name, abilityName, abilityDesc)
  VALUES (new.rowid, new.name, new.abilityName, new.abilityDesc);
END;

CREATE VIRTUAL TABLE IF NOT EXISTS traits_fts USING fts5(
  name, description,
  content='traits', content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS traits_ai AFTER INSERT ON traits BEGIN
  INSERT INTO traits_fts(rowid, name, description)
  VALUES (new.rowid, new.name, new.description);
END;
CREATE TRIGGER IF NOT EXISTS traits_ad AFTER DELETE ON traits BEGIN
  INSERT INTO traits_fts(traits_fts, rowid, name, description)
  VALUES ('delete', old.rowid, old.name, old.description);
END;
CREATE TRIGGER IF NOT EXISTS traits_au AFTER UPDATE ON traits BEGIN
  INSERT INTO traits_fts(traits_fts, rowid, name, description)
  VALUES ('delete', old.rowid, old.name, old.description);
  INSERT INTO traits_fts(rowid, name, description)
  VALUES (new.rowid, new.name, new.description);
END;

CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
  name, description,
  content='items', content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
  INSERT INTO items_fts(rowid, name, description)
  VALUES (new.rowid, new.name, new.description);
END;
CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
  INSERT INTO items_fts(items_fts, rowid, name, description)
  VALUES ('delete', old.rowid, old.name, old.description);
END;
CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE ON items BEGIN
  INSERT INTO items_fts(items_fts, rowid, name, description)
  VALUES ('delete', old.rowid, old.name, old.description);
  INSERT INTO items_fts(rowid, name, description)
  VALUES (new.rowid, new.name, new.description);
END;

CREATE VIRTUAL TABLE IF NOT EXISTS augments_fts USING fts5(
  name, description,
  content='augments', content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS augments_ai AFTER INSERT ON augments BEGIN
  INSERT INTO augments_fts(rowid, name, description)
  VALUES (new.rowid, new.name, new.description);
END;
CREATE TRIGGER IF NOT EXISTS augments_ad AFTER DELETE ON augments BEGIN
  INSERT INTO augments_fts(augments_fts, rowid, name, description)
  VALUES ('delete', old.rowid, old.name, old.description);
END;
CREATE TRIGGER IF NOT EXISTS augments_au AFTER UPDATE ON augments BEGIN
  INSERT INTO augments_fts(augments_fts, rowid, name, description)
  VALUES ('delete', old.rowid, old.name, old.description);
  INSERT INTO augments_fts(rowid, name, description)
  VALUES (new.rowid, new.name, new.description);
END;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_champions_cost ON champions(cost);
CREATE INDEX IF NOT EXISTS idx_champions_role ON champions(role);
CREATE INDEX IF NOT EXISTS idx_champion_traits_trait ON champion_traits(trait_name);
CREATE INDEX IF NOT EXISTS idx_champion_traits_champ ON champion_traits(champion_name);
CREATE INDEX IF NOT EXISTS idx_items_component ON items(isComponent);
