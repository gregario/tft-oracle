import { z } from 'zod';

// --- Input Schema ---

export const GetRollingOddsInput = z.object({
  level: z
    .number()
    .min(2)
    .max(10)
    .optional()
    .describe('Player level (2-10). Omit to get the full table.'),
});

export type GetRollingOddsInputType = z.infer<typeof GetRollingOddsInput>;

// --- Result types ---

export interface LevelOdds {
  level: number;
  odds: Record<string, number>;
}

export interface GetRollingOddsResult {
  levels: LevelOdds[];
}

export interface GetRollingOddsError {
  error: string;
}

// --- Static data: TFT Set 16 rolling odds ---

const ROLLING_ODDS: Record<number, Record<string, number>> = {
  2:  { '1-cost': 100 },
  3:  { '1-cost': 75, '2-cost': 25 },
  4:  { '1-cost': 55, '2-cost': 30, '3-cost': 15 },
  5:  { '1-cost': 45, '2-cost': 33, '3-cost': 20, '4-cost': 2 },
  6:  { '1-cost': 30, '2-cost': 40, '3-cost': 25, '4-cost': 5 },
  7:  { '1-cost': 19, '2-cost': 30, '3-cost': 35, '4-cost': 15, '5-cost': 1 },
  8:  { '1-cost': 18, '2-cost': 25, '3-cost': 32, '4-cost': 22, '5-cost': 3 },
  9:  { '1-cost': 10, '2-cost': 20, '3-cost': 25, '4-cost': 35, '5-cost': 10 },
  10: { '1-cost': 5,  '2-cost': 10, '3-cost': 20, '4-cost': 40, '5-cost': 25 },
};

// --- Handler ---

export function getRollingOdds(
  input: GetRollingOddsInputType,
): GetRollingOddsResult | GetRollingOddsError {
  if (input.level != null) {
    const odds = ROLLING_ODDS[input.level];
    if (!odds) {
      return { error: `Invalid level ${input.level}. Valid range is 2-10.` };
    }
    return { levels: [{ level: input.level, odds }] };
  }

  // Return full table
  const levels: LevelOdds[] = Object.entries(ROLLING_ODDS)
    .map(([lvl, odds]) => ({ level: Number(lvl), odds }))
    .sort((a, b) => a.level - b.level);

  return { levels };
}
