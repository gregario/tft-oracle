# MCP QA Report: tft-oracle
**Date:** 2026-03-18
**Mode:** full
**Server version:** 0.1.0
**Health score:** 92/100 — Ship it

## Discovery
- **Tools:** 8 registered
- **Resources:** 0 registered
- **Prompts:** 0 registered

## Tool Execution Results
| Tool | Status | Notes |
|------|--------|-------|
| search_champions | PASS | Found 20 champions (with limit), real data |
| get_champion | PASS | Jinx returned full profile with stats, traits, ability |
| search_traits | PASS | 50 traits returned |
| get_trait | PASS | Breakpoints and champion membership working |
| search_items | PASS | B.F. Sword found, component filter working |
| get_item_recipe | PASS | Recipe tree and builds-into working |
| search_augments | PASS | 149 augments available |
| get_rolling_odds | PASS | Full 9-level odds table returned |

## Best Practices Lint
| Check | Status | Severity |
|-------|--------|----------|
| No console.log | PASS | CRITICAL |
| Shebang on entry point | PASS | HIGH |
| chmod in build script | PASS | MEDIUM |
| All imports have .js extensions | PASS | HIGH |
| No 0.0.0.0 binding | PASS | CRITICAL |
| No secrets in parameters | PASS | CRITICAL |
| Error cases use isError: true | PASS | HIGH |
| Graceful shutdown handlers | PASS | LOW |
| Server name matches package.json | PASS | LOW |

## Findings
### FINDING-001: Augment descriptions contain unresolved variables
**Severity:** medium
**Category:** value
**Details:** Some augment descriptions still contain `@Variable@` template strings (e.g., "gain @AttackSpeed*100@% Attack Speed"). The variable resolver works for champion abilities but augment descriptions from the items array don't carry variables to resolve against. Consider stripping unresolvable `@...@` patterns or resolving from the effects JSON.

### FINDING-002: Crit multiplier displayed as raw float
**Severity:** low
**Category:** tool-quality
**Details:** Crit multiplier shows as `1.399999976158142x` instead of `1.4x`. Format to 1 decimal place.

## Score Breakdown
| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Connectivity | 100 | 20% | 20.0 |
| Tool Quality | 92 | 25% | 23.0 |
| Tool Execution | 100 | 25% | 25.0 |
| Best Practices | 100 | 15% | 15.0 |
| Security | 100 | 10% | 10.0 |
| Value Delivery | 92 | 5% | 4.6 |
| **Total** | | | **92/100** |
