#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createRequire } from 'node:module';
import type Database from 'better-sqlite3';

import { SearchChampionsInput, searchChampions } from './tools/search-champions.js';
import { GetChampionInput, getChampion } from './tools/get-champion.js';
import { SearchTraitsInput, searchTraits } from './tools/search-traits.js';
import { GetTraitInput, getTrait } from './tools/get-trait.js';
import { SearchItemsInput, searchItems } from './tools/search-items.js';
import { GetItemRecipeInput, getItemRecipe } from './tools/get-item-recipe.js';
import { SearchAugmentsInput, searchAugments } from './tools/search-augments.js';
import { GetRollingOddsInput, getRollingOdds } from './tools/get-rolling-odds.js';

import {
  formatSearchChampions,
  formatGetChampion,
  formatSearchTraits,
  formatGetTrait,
  formatSearchItems,
  formatGetItemRecipe,
  formatSearchAugments,
  formatGetRollingOdds,
} from './format.js';

import { getDatabase } from './data/db.js';
import { runPipeline } from './data/pipeline.js';

function getVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require('../package.json') as { version: string };
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

export function createServer(db: Database.Database) {
  const server = new McpServer(
    { name: 'tft-oracle', version: getVersion() },
    { capabilities: { tools: {} } },
  );

  // 1. search_champions
  server.tool(
    'search_champions',
    'Search for TFT champions by name, cost, trait, or role. Returns a summary list — use get_champion for full details on a specific champion.',
    SearchChampionsInput.shape,
    async (params) => {
      try {
        const result = searchChampions(db, params);
        return {
          content: [{ type: 'text' as const, text: formatSearchChampions(result) }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // 2. get_champion
  server.tool(
    'get_champion',
    'Get complete details for a specific TFT champion including all stats, traits, and ability description. Supports fuzzy name matching.',
    GetChampionInput.shape,
    async (params) => {
      try {
        const result = getChampion(db, params);
        return {
          content: [{ type: 'text' as const, text: formatGetChampion(result) }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // 3. search_traits
  server.tool(
    'search_traits',
    'Search TFT traits by name or description. Omit the query to list all traits in the current set.',
    SearchTraitsInput.shape,
    async (params) => {
      try {
        const result = searchTraits(db, params);
        return {
          content: [{ type: 'text' as const, text: formatSearchTraits(result) }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // 4. get_trait
  server.tool(
    'get_trait',
    'Get full details for a TFT trait including breakpoint thresholds, scaling values, and all champions with this trait. Use this to understand synergy requirements.',
    GetTraitInput.shape,
    async (params) => {
      try {
        const result = getTrait(db, params);
        return {
          content: [{ type: 'text' as const, text: formatGetTrait(result) }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // 5. search_items
  server.tool(
    'search_items',
    'Search TFT items by name, description, or component. Use componentsOnly to see base components, or the component filter to find what a component builds into.',
    SearchItemsInput.shape,
    async (params) => {
      try {
        const result = searchItems(db, params);
        return {
          content: [{ type: 'text' as const, text: formatSearchItems(result) }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // 6. get_item_recipe
  server.tool(
    'get_item_recipe',
    'Get the recipe for a TFT item (which components build it) or see what a component builds into. Use this for item planning and carousel decisions.',
    GetItemRecipeInput.shape,
    async (params) => {
      try {
        const result = getItemRecipe(db, params);
        return {
          content: [{ type: 'text' as const, text: formatGetItemRecipe(result) }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // 7. search_augments
  server.tool(
    'search_augments',
    'Search TFT augments by name or description. Omit the query to list all augments in the current set.',
    SearchAugmentsInput.shape,
    async (params) => {
      try {
        const result = searchAugments(db, params);
        return {
          content: [{ type: 'text' as const, text: formatSearchAugments(result) }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // 8. get_rolling_odds
  server.tool(
    'get_rolling_odds',
    'Get TFT champion shop rolling odds by player level. Shows the probability of seeing each cost tier (1-5) at a given level. Omit the level to see the full table.',
    GetRollingOddsInput.shape,
    async (params) => {
      try {
        const result = getRollingOdds(params);
        return {
          content: [{ type: 'text' as const, text: formatGetRollingOdds(result) }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  return server;
}

async function main(): Promise<void> {
  const version = getVersion();
  const db = getDatabase();

  // Run data pipeline
  try {
    console.error('[tft-oracle] Starting data pipeline...');
    await runPipeline(db);
    console.error('[tft-oracle] Pipeline complete');
  } catch (err) {
    console.error(
      `[tft-oracle] Pipeline error: ${err instanceof Error ? err.message : String(err)}`,
    );
    console.error('[tft-oracle] Continuing with existing data (if any)...');
  }

  const server = createServer(db);
  const transport = new StdioServerTransport();
  console.error(`[tft-oracle] v${version} starting on stdio...`);
  await server.connect(transport);
  console.error('[tft-oracle] Server running — 8 tools registered');

  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(
    `[tft-oracle] Fatal: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
