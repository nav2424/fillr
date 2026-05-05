/**
 * Merge duplicate ingredient lines from bilingual (e.g. Canadian EN/FR) Open Food Facts labels.
 */

import { frenchLikelihood } from './bilingualDisplay'
import { normalizeText } from './allergenEngine/matcher'

/**
 * Synonym groups: same ingredient in different languages/forms.
 * Longer phrases are checked first within each group.
 */
const EQUIV_GROUPS: string[][] = [
  ['eau', 'water', 'aqua', 'agua'],
  ['sucre', 'sugar', 'azúcar', 'azucar', 'zucker'],
  ['sel', 'salt', 'sea salt', 'salz', 'meersalz'],
  ['levure', 'yeast', "baker's yeast", 'bakers yeast', 'hefe'],
  ['lait', 'milk', 'whole milk', 'skim milk', 'leche', 'vollmilch', 'magermilch'],
  ['beurre', 'butter', 'mantequilla', 'manteiga'],
  ['crème', 'cream', 'heavy cream', 'crème fouettée', 'nata'],
  ['huile végétale', 'huile vegetale', 'vegetable oil', 'aceite vegetal', 'pflanzenöl'],
  ['huile de palme', 'aceite de palma', 'palm oil', 'palmöl'],
  ['huile de tournesol', 'aceite de girasol', 'sunflower oil', 'sonnenblumenöl'],
  ['huile de colza', 'aceite de colza', 'canola oil', 'rapeseed oil'],
  ['huile de maïs', 'corn oil', 'aceite de maíz'],
  ["huile d'olive", 'olive oil', 'aceite de oliva', 'olivenöl'],
  ['farine de blé', 'farine de ble', 'wheat flour', 'enriched wheat flour', 'unbleached enriched flour', 'harina de trigo', 'weizenmehl'],
  ['farine de maïs', 'corn flour', 'maismehl'],
  ['farine de riz', 'rice flour', 'reismehl'],
  ['amidon de maïs', 'amidon de mais', 'corn starch', 'modified corn starch', 'maisstärke'],
  ['lécithine de soja', 'lecithine de soja', 'soy lecithin', 'soya lecithin', 'sojalecithin', 'lecitina de soja'],
  ['protéines de lactosérum', 'proteines de lactoserum', 'whey protein', 'lactoserum', 'molkenprotein'],
  ['poudre de lait écrémé', 'lait écrémé en poudre', 'skim milk powder', 'nonfat dry milk', 'magermilchpulver'],
  ['œuf', 'oeuf', 'oeufs', 'egg', 'eggs', 'eier', 'huevos'],
  ['cacao', 'cocoa'],
  ['sirop de maïs', 'sirop de mais', 'corn syrup', 'maissirup'],
  ['sirop de glucose-fructose', 'glucose-fructose syrup', 'glucose fructose syrup', 'isoglucose'],
  ['amidon modifié', 'modified starch', 'modified food starch'],
  ['arôme naturel', 'arome naturel', 'natural flavor', 'natural flavour'],
  ['arôme artificiel', 'artificial flavor', 'artificial flavour'],
  ['épices', 'epices', 'spices'],
  ['mustard seed', 'mustard', 'moutarde', 'graines de moutarde', 'moutarde en poudre'],
  ['extrait de levure', 'yeast extract', 'hefeextrakt'],
  ['orge maltée', 'malted barley', 'barley malt extract', 'gerstenmalzextrakt'],
  ['café', 'coffee'],
  ['thé', 'tea'],
  ['calcium propionate', 'propionate de calcium'],
  ['sorbic acid', 'acide sorbique'],
  ['defatted soy flour', 'farine de soya dégraissée', 'farine de soja dégraissée'],
  ['vegetable monoglycerides', 'monoglycérides végétaux', 'monoglycerides végétaux'],
  ['sodium stearoyl-2-lactylate', 'stéaroyl-2-lactylate de sodium', 'sodium stearoyl lactylate'],
]

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

/**
 * Some OFF labels concatenate the full English list and then the same list in French without
 * an `Ingrédients:` header. Drop the trailing French block when scores jump mid-list.
 */
export function dropTrailingFrenchDuplicateBlock(names: string[]): string[] {
  if (names.length < 6) return names
  const scores = names.map((n) => frenchLikelihood(n))

  let cut = -1
  for (let i = 2; i < names.length; i++) {
    const prevRun = avg(scores.slice(Math.max(0, i - 2), i))
    const here = scores[i]
    if (prevRun < 3.5 && here >= 5 && i >= Math.floor(names.length * 0.3)) {
      cut = i
      break
    }
  }

  if (cut === -1 && names.length >= 10) {
    const mid = Math.floor(names.length / 2)
    const firstAvg = avg(scores.slice(0, mid))
    const secondAvg = avg(scores.slice(mid))
    if (secondAvg >= firstAvg + 3 && secondAvg >= 5) {
      for (let i = mid; i < names.length; i++) {
        if (scores[i] >= 4 && scores[i - 1] < 3.5) {
          cut = i
          break
        }
      }
    }
  }

  if (cut > 0 && cut < names.length) {
    return names.slice(0, cut)
  }
  return names
}

const EN_DISPLAY = new Set(
  [
    'water',
    'sugar',
    'salt',
    'yeast',
    'milk',
    'butter',
    'cream',
    'vegetable oil',
    'palm oil',
    'sunflower oil',
    'canola oil',
    'corn oil',
    'olive oil',
    'wheat flour',
    'corn flour',
    'rice flour',
    'corn starch',
    'soy lecithin',
    'whey protein',
    'skim milk powder',
    'egg',
    'cocoa',
    'corn syrup',
    'glucose-fructose syrup',
    'modified starch',
    'natural flavor',
    'artificial flavor',
    'spices',
    'yeast extract',
    'barley malt extract',
    'coffee',
    'tea',
    'calcium propionate',
    'sorbic acid',
    'defatted soy flour',
    'vegetable monoglycerides',
    'sodium stearoyl-2-lactylate',
  ].map((s) => normalizeText(s))
)

function titleCaseLine(s: string): string {
  return s.replace(/\b([a-zàâäéèêëïîôùûüç])/gi, (c) => c.toUpperCase())
}

function phraseMatchesNormalized(normalizedFull: string, fragment: string): boolean {
  const f = normalizeText(fragment)
  if (!f) return false
  if (normalizedFull === f) return true
  if (normalizedFull.startsWith(f + ' ')) return true
  if (normalizedFull.endsWith(' ' + f) || normalizedFull.endsWith(f)) return true
  return normalizedFull.includes(' ' + f + ' ')
}

function matchEquivalenceGroup(normalized: string): { key: string; display: string } | null {
  for (const g of EQUIV_GROUPS) {
    const sortedByLen = [...g].sort(
      (a, b) => normalizeText(b).length - normalizeText(a).length
    )
    for (const syn of sortedByLen) {
      if (phraseMatchesNormalized(normalized, syn)) {
        const key = g.map((x) => normalizeText(x)).sort().join('|')
        const pick =
          g.find((w) => EN_DISPLAY.has(normalizeText(w))) ??
          g.find((w) => /^[A-Za-z]/.test(w.trim())) ??
          g[0]
        return { key, display: titleCaseLine(pick.trim()) }
      }
    }
  }
  return null
}

/**
 * Drop duplicate ingredient names that differ only by language (after normalization).
 * Preserves first-seen order; uses English display when collapsing a known pair.
 */
export function dedupeBilingualIngredientNames(names: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of names) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    const n = normalizeText(trimmed)
    const eq = matchEquivalenceGroup(n)
    const key = eq?.key ?? n
    if (seen.has(key)) continue
    seen.add(key)
    out.push(eq?.display ?? trimmed)
  }
  return dropTrailingFrenchDuplicateBlock(out)
}
