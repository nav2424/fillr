/**
 * Sensitivity keyword matching for a single ingredient line.
 * Short terms like "malt" must use word boundaries so "maltol" / "maltodextrin" are not flagged as grain malt.
 */
export function ingredientLineMatchesSensitivityTerm(ingredientLine: string, term: string): boolean {
  const ing = ingredientLine.toLowerCase()
  const t = term.toLowerCase()
  if (t === 'malt') return /\bmalt\b/.test(ing)
  return ing.includes(t)
}
