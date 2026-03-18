import type {
  TftRawData,
  RawSetData,
  RawChampion,
  RawTrait,
  RawItem,
  RawVariable,
  Champion,
  Trait,
  Item,
  Augment,
} from './types.js';

// --- Set detection ---

/**
 * Detect the current (highest-numbered) set from the raw data.
 * Uses the `sets` key, picking the highest numeric key.
 */
export function detectCurrentSet(data: TftRawData): string {
  const numericKeys = Object.keys(data.sets).filter(k => /^\d+$/.test(k));
  if (numericKeys.length === 0) {
    throw new Error('No numbered sets found in TFT data');
  }
  return numericKeys.reduce((max, k) => (Number(k) > Number(max) ? k : max));
}

/**
 * Get the set data for a given set number.
 */
export function getSetData(data: TftRawData, setNumber: string): RawSetData {
  const setData = data.sets[setNumber];
  if (!setData) {
    throw new Error(`Set ${setNumber} not found in TFT data`);
  }
  return setData;
}

// --- Description resolution ---

/**
 * Strip HTML/TFT markup tags from a description string.
 * Converts <br> to newline, removes all other tags.
 */
export function stripMarkup(desc: string): string {
  if (!desc) return '';
  return desc
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+>/g, '')
    .trim();
}

/**
 * Resolve @Variable@ template placeholders in a description.
 *
 * Variables can have:
 * - Simple values: @Damage@ → "100"
 * - Star-level scaling arrays: @Damage@ → "100/150/200" (1-star/2-star/3-star)
 * - Math expressions: @Damage*100@ → multiply value by 100
 *
 * Also handles %i:scaleAD% style formatting tags by stripping them.
 */
export function resolveDescription(
  desc: string,
  variables: RawVariable[]
): string {
  if (!desc) return '';

  // Build lookup map (case-insensitive)
  const varMap = new Map<string, number | number[]>();
  for (const v of variables) {
    if (v.name != null && v.value != null) {
      varMap.set(v.name.toLowerCase(), v.value);
    }
  }

  // Replace @VarName@ and @VarName*multiplier@ patterns
  let resolved = desc.replace(/@(\w+)(?:\*(\d+(?:\.\d+)?))?@/g, (_match, name: string, multiplier?: string) => {
    const value = varMap.get(name.toLowerCase());
    if (value === undefined) return _match; // keep original if not found

    const mult = multiplier ? parseFloat(multiplier) : 1;

    if (Array.isArray(value)) {
      // Star-level scaling: show as "val1/val2/val3"
      // Skip first element if it's 0 (often a placeholder for 0-star)
      const levels = value.length > 3 && value[0] === 0 ? value.slice(1) : value;
      return levels
        .map(v => formatNumber(v * mult))
        .join('/');
    }

    return formatNumber(value * mult);
  });

  // Strip %i:scaleXX% formatting tags
  resolved = resolved.replace(/%i:\w+%/g, '');

  // Strip HTML/TFT markup
  resolved = stripMarkup(resolved);

  return resolved;
}

/**
 * Format a number: drop trailing zeros, round to 2 decimals.
 */
function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  // Round to 2 decimal places and strip trailing zeros
  return parseFloat(n.toFixed(2)).toString();
}

// --- Champion parsing ---

/**
 * Parse champions from set data.
 * Filters out non-playable units (those without traits).
 */
export function parseChampions(setData: RawSetData): Champion[] {
  return setData.champions
    .filter(c => c.traits.length > 0) // Only real champions
    .map(parseChampion);
}

function parseChampion(raw: RawChampion): Champion {
  return {
    name: raw.name,
    apiName: raw.apiName,
    cost: raw.cost,
    role: raw.role ?? null,
    hp: raw.stats.hp ?? null,
    ad: raw.stats.damage ?? null,
    armor: raw.stats.armor ?? null,
    mr: raw.stats.magicResist ?? null,
    attackSpeed: raw.stats.attackSpeed ?? null,
    mana: raw.stats.mana,
    initialMana: raw.stats.initialMana,
    range: raw.stats.range,
    critChance: raw.stats.critChance ?? null,
    critMultiplier: raw.stats.critMultiplier ?? null,
    abilityName: raw.ability.name,
    abilityDesc: resolveDescription(raw.ability.desc, raw.ability.variables),
    abilityVariables: JSON.stringify(
      raw.ability.variables.filter(v => v.name != null && v.value != null)
    ),
    traits: raw.traits,
  };
}

// --- Trait parsing ---

/**
 * Parse traits from set data with their breakpoints.
 */
export function parseTraits(setData: RawSetData): Trait[] {
  return setData.traits.map(parseTrait);
}

function parseTrait(raw: RawTrait): Trait {
  // Resolve description using the first breakpoint's variables if available
  const firstEffect = raw.effects[0];
  const mockVariables: RawVariable[] = firstEffect
    ? Object.entries(firstEffect.variables).map(([name, value]) => ({ name, value }))
    : [];

  return {
    name: raw.name,
    apiName: raw.apiName,
    description: resolveDescription(raw.desc, mockVariables),
    breakpoints: raw.effects.map(e => ({
      minUnits: e.minUnits,
      maxUnits: e.maxUnits,
      style: e.style,
      variables: e.variables,
    })),
  };
}

// --- Item & augment parsing ---

/**
 * Determine the current set prefix (e.g., "TFT16") for filtering augments.
 */
function getCurrentSetPrefix(setNumber: string): string {
  return `TFT${setNumber}`;
}

/**
 * Check if a raw item is an augment.
 * Augments are identified by having "Augment" in their apiName.
 */
export function isAugment(item: RawItem): boolean {
  return item.apiName.includes('Augment');
}

/**
 * Check if a raw item is a component (base crafting item).
 */
export function isComponent(item: RawItem): boolean {
  return item.tags.includes('component');
}

/**
 * Parse items from the raw items array.
 * Separates regular items from augments.
 * Filters to base items (TFT_Item_ prefix) and current-set items only.
 *
 * @param items - Raw items array from CommunityDragon
 * @param currentSetNumber - The current set number (e.g., "16")
 */
export function parseItems(
  items: RawItem[],
  currentSetNumber: string
): { items: Item[]; augments: Augment[] } {
  const setPrefix = getCurrentSetPrefix(currentSetNumber);
  const parsedItems: Item[] = [];
  const parsedAugments: Augment[] = [];

  for (const raw of items) {
    // Skip items from other sets (keep base TFT_Item_ items and current set items)
    const isBaseItem = raw.apiName.startsWith('TFT_Item_');
    const isCurrentSet = raw.apiName.startsWith(setPrefix);

    if (!isBaseItem && !isCurrentSet) continue;

    // Skip items with no name (e.g., TFT_Item_EmptyBag, TFT_Item_Blank)
    if (!raw.name) continue;

    if (isAugment(raw)) {
      parsedAugments.push(parseAugment(raw));
    } else {
      parsedItems.push(parseItem(raw));
    }
  }

  return { items: parsedItems, augments: parsedAugments };
}

function parseItem(raw: RawItem): Item {
  return {
    name: raw.name,
    apiName: raw.apiName,
    description: stripMarkup(raw.desc),
    effects: JSON.stringify(raw.effects),
    composition: JSON.stringify(raw.composition),
    tags: raw.tags.join(','),
    isComponent: isComponent(raw),
    unique: raw.unique,
  };
}

function parseAugment(raw: RawItem): Augment {
  // Resolve @Variable@ templates using effects data
  const effectVars: RawVariable[] = raw.effects
    ? Object.entries(raw.effects).map(([name, value]) => ({
        name,
        value: value as number | number[] | null,
      }))
    : [];
  return {
    name: raw.name,
    apiName: raw.apiName,
    description: resolveDescription(raw.desc, effectVars),
    effects: JSON.stringify(raw.effects),
  };
}
