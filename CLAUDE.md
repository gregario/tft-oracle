# tft-oracle — Teamfight Tactics MCP Server

Reference oracle for TFT game data. Provides accurate champion, trait, item, and augment data to LLMs using CommunityDragon as the data source.

## Stack
- TypeScript, MCP SDK, better-sqlite3, Zod
- Read `stacks/mcp/` and `stacks/mcp/tool_design.md` before modifying tools

## Architecture
- `src/data/` — Data pipeline (fetch, parse, ingest, schema)
- `src/tools/` — MCP tool implementations
- `src/server.ts` — Main entry point
- `tests/` — Vitest tests

## Data Source
CommunityDragon: `raw.communitydragon.org/latest/cdragon/tft/en_us.json`
- Auto-fetched on first run, cached at `~/.tft-oracle/`
- Static data only — no Riot API key required
- Current set only (highest numbered set in the JSON)

## Legal
Operates under Riot Games' Legal Jibber Jabber policy. All tool outputs and README must include:
- "tft-oracle isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties."
- CommunityDragon attribution

## Commands
- `npm test` — run tests
- `npm run build` — compile TypeScript
- `npm start` — start server

## MCP Server Notes
- `package.json` must have `"engines": {"node": ">=18"}` and `"type": "module"`.
- Glama deploy: Auto-detect is broken. NEVER trust Glama defaults. See `stacks/mcp/publishing.md`.
