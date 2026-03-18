// --- Raw data types (CommunityDragon JSON shape) ---

export interface TftRawData {
  items: RawItem[];
  setData: Record<string, RawSetData>;
  sets: Record<string, RawSetData>;
}

export interface RawSetData {
  champions: RawChampion[];
  name: string;
  traits: RawTrait[];
}

export interface RawChampion {
  ability: RawAbility;
  apiName: string;
  characterName: string;
  cost: number;
  icon: string;
  name: string;
  role: string | null;
  squareIcon: string;
  stats: RawStats;
  tileIcon: string;
  traits: string[];
}

export interface RawAbility {
  desc: string;
  icon: string;
  name: string;
  variables: RawVariable[];
}

export interface RawVariable {
  name: string | null;
  value: number | number[] | null;
}

export interface RawStats {
  armor: number | null;
  attackSpeed: number | null;
  critChance: number | null;
  critMultiplier: number | null;
  damage: number | null;
  hp: number | null;
  initialMana: number;
  magicResist: number | null;
  mana: number;
  range: number;
}

export interface RawTrait {
  apiName: string;
  desc: string;
  effects: RawTraitEffect[];
  icon: string;
  name: string;
}

export interface RawTraitEffect {
  maxUnits: number;
  minUnits: number;
  style: number;
  variables: Record<string, number>;
}

export interface RawItem {
  apiName: string;
  associatedTraits: string[];
  composition: string[];
  desc: string;
  effects: Record<string, number>;
  from: number | null;
  icon: string;
  id: number | null;
  incompatibleTraits: string[];
  name: string;
  tags: string[];
  unique: boolean;
}

// --- Parsed/normalized types ---

export interface Champion {
  name: string;
  apiName: string;
  cost: number;
  role: string | null;
  hp: number | null;
  ad: number | null;
  armor: number | null;
  mr: number | null;
  attackSpeed: number | null;
  mana: number;
  initialMana: number;
  range: number;
  critChance: number | null;
  critMultiplier: number | null;
  abilityName: string;
  abilityDesc: string;
  abilityVariables: string; // JSON
  traits: string[];
}

export interface Trait {
  name: string;
  apiName: string;
  description: string;
  breakpoints: TraitBreakpoint[];
}

export interface TraitBreakpoint {
  minUnits: number;
  maxUnits: number;
  style: number;
  variables: Record<string, number>;
}

export interface Item {
  name: string;
  apiName: string;
  description: string;
  effects: string; // JSON
  composition: string; // JSON array
  tags: string;
  isComponent: boolean;
  unique: boolean;
}

export interface Augment {
  name: string;
  apiName: string;
  description: string;
  effects: string; // JSON
}
