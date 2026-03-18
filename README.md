# tft-oracle

Teamfight Tactics MCP server — accurate champion, trait, item, and augment data for LLMs.

<p align="center">
  <a href="https://www.npmjs.com/package/tft-oracle"><img src="https://img.shields.io/npm/v/tft-oracle.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/tft-oracle"><img src="https://img.shields.io/npm/dm/tft-oracle.svg" alt="npm downloads"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg" alt="Node.js 18+"></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-compatible-purple.svg" alt="MCP Compatible"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
  <a href="https://github.com/sponsors/gregario"><img src="https://img.shields.io/badge/sponsor-♥-ea4aaa.svg" alt="Sponsor"></a>
</p>

[![tft-oracle MCP server](https://glama.ai/mcp/servers/gregario/tft-oracle/badges/card.svg)](https://glama.ai/mcp/servers/gregario/tft-oracle)

Stop LLMs from hallucinating TFT data. tft-oracle gives AI assistants accurate, up-to-date game knowledge sourced from [CommunityDragon](https://communitydragon.org).

## Features

- **Champions** — Full stats, traits, abilities, and costs for all champions in the current set
- **Traits** — Breakpoint thresholds, scaling values, and champion membership
- **Items** — Complete recipe tree, stat effects, and component relationships
- **Augments** — Descriptions and effects
- **Rolling Odds** — Shop probability tables by player level
- **Auto-updates** — Data refreshes from CommunityDragon on each server start

## Tools

| Tool | Description |
|------|-------------|
| `search_champions` | Search champions by name, cost, trait, or role |
| `get_champion` | Full champion profile with stats, traits, and ability |
| `search_traits` | Search and list traits |
| `get_trait` | Trait detail with breakpoints and champion list |
| `search_items` | Search items by name or component |
| `get_item_recipe` | Item recipe tree and reverse lookups |
| `search_augments` | Search augments by name or effect |
| `get_rolling_odds` | Champion shop odds by player level |

## Install

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "tft-oracle": {
      "command": "npx",
      "args": ["-y", "tft-oracle"]
    }
  }
}
```

### CLI

```bash
npx tft-oracle
```

## Data Source

Game data is sourced from [CommunityDragon](https://communitydragon.org), which extracts structured data from Riot Games' TFT client files. Data is fetched on first run and cached locally at `~/.tft-oracle/`. It auto-updates when CommunityDragon publishes new patch data.

No Riot Games API key is required.

## Legal

tft-oracle isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, Teamfight Tactics, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.

Game data provided by [CommunityDragon](https://communitydragon.org), created under Riot Games' "Legal Jibber Jabber" policy.

## License

MIT