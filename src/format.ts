import type { SearchChampionsResult } from './tools/search-champions.js';
import type { GetChampionResult } from './tools/get-champion.js';
import type { SearchTraitsResult } from './tools/search-traits.js';
import type { GetTraitResult } from './tools/get-trait.js';
import type { SearchItemsResult } from './tools/search-items.js';
import type { GetItemRecipeResult, GetItemRecipeError } from './tools/get-item-recipe.js';
import type { SearchAugmentsResult } from './tools/search-augments.js';
import type { GetRollingOddsResult, GetRollingOddsError } from './tools/get-rolling-odds.js';

const ATTRIBUTION =
  '\n\n---\nData: CommunityDragon (communitydragon.org) · Not endorsed by Riot Games';

export function formatSearchChampions(result: SearchChampionsResult): string {
  if (result.champions.length === 0) {
    return 'No champions found matching your criteria.' + ATTRIBUTION;
  }
  const lines = result.champions.map(
    (c) => `• ${c.name} (${c.cost}⭐) — ${c.role ?? 'unknown'} — ${c.traits} — ${c.hp} HP / ${c.ad} AD`,
  );
  return `Found ${result.total} champion(s):\n\n${lines.join('\n')}` + ATTRIBUTION;
}

export function formatGetChampion(result: GetChampionResult): string {
  if (!result.found) {
    const suggestions = result.suggestions?.length
      ? `\n\nDid you mean: ${result.suggestions.join(', ')}?`
      : '';
    return `${result.message}${suggestions}` + ATTRIBUTION;
  }
  const c = result.champion;
  return [
    `# ${c.name} (${c.cost}⭐ ${c.role ?? 'unknown'})`,
    '',
    `**Traits:** ${c.traits.join(', ')}`,
    '',
    '**Stats:**',
    `HP: ${c.hp} | AD: ${c.ad} | Armor: ${c.armor} | MR: ${c.mr}`,
    `AS: ${c.attackSpeed} | Range: ${c.range} | Mana: ${c.initialMana}/${c.mana}`,
    `Crit: ${c.critChance != null ? (c.critChance * 100).toFixed(0) : '?'}% (${c.critMultiplier ?? '?'}x)`,
    '',
    `**Ability — ${c.ability.name.trim()}**`,
    c.ability.description,
  ].join('\n') + ATTRIBUTION;
}

export function formatSearchTraits(result: SearchTraitsResult): string {
  if (result.traits.length === 0) {
    return 'No traits found matching your query.' + ATTRIBUTION;
  }
  const lines = result.traits.map(
    (t) => `• ${t.name} (${t.breakpointCount} breakpoints) — ${t.description}`,
  );
  return `Found ${result.total} trait(s):\n\n${lines.join('\n')}` + ATTRIBUTION;
}

export function formatGetTrait(result: GetTraitResult): string {
  if (!result.found) {
    const suggestions = result.suggestions?.length
      ? `\nDid you mean: ${result.suggestions.join(', ')}?`
      : '';
    return `${result.message}${suggestions}` + ATTRIBUTION;
  }
  const t = result.trait;
  const bpLines = t.breakpoints.map((bp) => {
    const vars = Object.entries(bp.variables)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    return `  (${bp.minUnits}) ${vars}`;
  });
  const champLines = t.champions.map((c) => `  ${c.name} (${c.cost}⭐)`);
  return [
    `# ${t.name}`,
    '',
    t.description,
    '',
    '**Breakpoints:**',
    ...bpLines,
    '',
    `**Champions (${t.champions.length}):**`,
    ...champLines,
  ].join('\n') + ATTRIBUTION;
}

export function formatSearchItems(result: SearchItemsResult): string {
  if (result.items.length === 0) {
    return 'No items found matching your query.' + ATTRIBUTION;
  }
  const lines = result.items.map((i) => {
    const tag = i.isComponent ? '[Component]' : `[${i.composition ?? ''}]`;
    return `• ${i.name} ${tag} — ${i.description ?? ''}`;
  });
  return `Found ${result.total} item(s):\n\n${lines.join('\n')}` + ATTRIBUTION;
}

export function formatGetItemRecipe(result: GetItemRecipeResult | GetItemRecipeError): string {
  if ('error' in result) {
    const suggestions = result.suggestions?.length
      ? `\nDid you mean: ${result.suggestions.join(', ')}?`
      : '';
    return `${result.error}${suggestions}` + ATTRIBUTION;
  }

  const r = result.result;
  const lines = [`# ${r.item.name}`, '', r.item.description ?? ''];

  if (r.components) {
    lines.push('', '**Recipe:**');
    r.components.forEach((c) => lines.push(`  + ${c.name}`));
  }

  if (r.buildsInto && r.buildsInto.length > 0) {
    lines.push('', '**Builds into:**');
    r.buildsInto.forEach((b) =>
      lines.push(`  → ${b.item.name} (with ${b.otherComponent.name})`),
    );
  }

  return lines.join('\n') + ATTRIBUTION;
}

export function formatSearchAugments(result: SearchAugmentsResult): string {
  if (result.augments.length === 0) {
    return 'No augments found matching your query.' + ATTRIBUTION;
  }
  const lines = result.augments.map((a) => `• ${a.name} — ${a.description}`);
  return `Found ${result.total} augment(s):\n\n${lines.join('\n')}` + ATTRIBUTION;
}

export function formatGetRollingOdds(result: GetRollingOddsResult | GetRollingOddsError): string {
  if ('error' in result) {
    return `Error: ${result.error}`;
  }

  if (result.levels.length === 1) {
    const row = result.levels[0];
    const entries = Object.entries(row.odds)
      .map(([cost, pct]) => `${cost}: ${pct}%`)
      .join(' | ');
    return `**Rolling odds at level ${row.level}:**\n${entries}` + ATTRIBUTION;
  }

  const header = 'Lvl | 1⭐   | 2⭐   | 3⭐   | 4⭐   | 5⭐';
  const sep = '----|-------|-------|-------|-------|------';
  const rows = result.levels.map((row) => {
    const o = row.odds;
    return `${String(row.level).padStart(3)} | ${String(o['1-cost'] ?? 0).padStart(4)}% | ${String(o['2-cost'] ?? 0).padStart(4)}% | ${String(o['3-cost'] ?? 0).padStart(4)}% | ${String(o['4-cost'] ?? 0).padStart(4)}% | ${String(o['5-cost'] ?? 0).padStart(4)}%`;
  });
  return `**TFT Rolling Odds Table:**\n\n${header}\n${sep}\n${rows.join('\n')}` + ATTRIBUTION;
}
