import type { FillrScoringDataSnapshot } from '../types'

export type FormulaConcernCategory = {
  id: string
  title: string
  detail: string
  ingredients: string[]
  severity: 'high' | 'medium' | 'low'
}

function normName(name: string): string {
  return String(name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[#'"().]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function displayName(raw: string): string {
  const t = sanitizeConcernLabel(raw)
  if (!t) return ''
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Strip list glue words so "canola oil and" never surfaces as an ingredient name. */
export function sanitizeConcernLabel(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+(?:and\/or|and|or)\s*$/i, '')
    .replace(/^\s*(?:and\/or|and|or)\s+/i, '')
    .replace(/^[(\[]+|[)\].,;]+|[)\].,;]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const BARE_OIL_TYPE_RE =
  /^(canola|rapeseed|soybean|corn|cottonseed|sunflower|safflower|grapeseed)$/i

function normalizeOilSegment(segment: string): string {
  const t = segment.trim()
  if (!t || /\boil\b/i.test(t)) return t
  if (BARE_OIL_TYPE_RE.test(t)) return `${t} oil`
  return t
}

function expandIngredientSegments(raw: string): string[] {
  const source = String(raw ?? '').trim()
  if (!source) return []

  const segments = new Set<string>()
  const add = (value: string) => {
    const t = sanitizeConcernLabel(value)
    if (t) segments.add(t)
  }

  const paren = source.match(/\(([^)]+)\)/)
  if (paren?.[1]) {
    for (const part of paren[1].split(/\s*,\s*|\s+and\/or\s+|\s+and\s+|\s*&\s*/)) {
      add(normalizeOilSegment(part))
    }
    add(source.replace(/\([^)]+\)/, ' ').replace(/\s+/g, ' ').trim())
  }

  for (const part of source.split(/\s*,\s*|\s+and\/or\s+|\s+and\s+|\s*&\s*/)) {
    add(normalizeOilSegment(part))
  }

  return [...segments].map((segment) => normName(segment)).filter(Boolean)
}

function matchIngredients(names: string[], re: RegExp): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const reGlobal = new RegExp(re.source, re.flags.includes('i') ? 'gi' : 'g')

  for (const raw of names) {
    for (const segment of expandIngredientSegments(raw)) {
      reGlobal.lastIndex = 0
      for (const match of segment.matchAll(reGlobal)) {
        const hit = displayName(match[0] ?? '')
        if (!hit || /\b(?:and|or)\s*$/i.test(hit)) continue
        const key = hit.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push(hit)
      }
    }
  }
  return out
}

const SEED_OIL_RE =
  /\b(?:expeller\s+pressed\s+)?(?:canola|rapeseed|soybean|corn|cottonseed|sunflower|safflower|grapeseed)\s+oil\b|\bvegetable\s+oil\b|\bpalm(?:\s+kernel)?\s+oil\b/gi

const PRESERVATIVE_RE =
  /\b(sodium benzoate|potassium sorbate|sorbic acid|benzoic acid|calcium propionate|sodium propionate|sodium nitrite|sodium nitrate|potassium nitrate|tbhq|bht|bha|edta|calcium disodium|disodium edta|trisodium edta|propyl gallate|sodium sulfite|potassium sulfite|sodium bisulfite|sodium metabisulfite|sulphite|sulfite|preservative|preservatives)\b/i

const EMULSIFIER_RE =
  /\b(carrageenan|polysorbate|mono[\s-]?and[\s-]?diglycerides|diglyceride|monoglyceride|xanthan gum|guar gum|carboxymethylcellulose|cellulose gum|soy lecithin|sunflower lecithin|\blecithin\b|pgpr|polyglycerol polyricinoleate|emulsifier)\b/i

const ARTIFICIAL_SWEETENER_RE =
  /\b(sucralose|aspartame|acesulfame(?:\s+potassium)?|acesulfame k|saccharin|neotame|advantame|splenda|sodium cyclamate|cyclamate)\b/i

const ARTIFICIAL_COLOR_RE =
  /\b(red\s*40|red\s*3|yellow\s*5|yellow\s*6|blue\s*1|blue\s*2|green\s*3|tartrazine|allura red|fd&c|artificial color|artificial colour|colour caramel|caramel color|caramel colour)\b/i

const INDUSTRIAL_SWEETENER_RE =
  /\b(high fructose corn syrup|\bhfcs\b|glucose fructose syrup|glucose-fructose syrup|corn syrup|maltodextrin)\b/i

/** Deterministic formula flags everyone sees — seed oils, preservatives, emulsifiers, etc. */
export function buildFormulaConcerns(
  ingredientNames: string[],
  scoringData?: FillrScoringDataSnapshot | null
): FormulaConcernCategory[] {
  const names = ingredientNames.map((n) => String(n ?? '').trim()).filter(Boolean)
  if (!names.length) return []

  const concerns: FormulaConcernCategory[] = []

  const seedOils = matchIngredients(names, SEED_OIL_RE)
  if (seedOils.length > 0 || scoringData?.hasSeedOils) {
    concerns.push({
      id: 'seed_oils',
      title: 'Seed & refined oils',
      detail: 'Refined seed oils are common in snacks — often higher in omega-6 than olive or avocado oil.',
      ingredients: seedOils.slice(0, 4),
      severity: 'medium',
    })
  }

  const preservatives = matchIngredients(names, PRESERVATIVE_RE)
  if (preservatives.length > 0) {
    concerns.push({
      id: 'preservatives',
      title: 'Preservatives',
      detail: 'Synthetic preservatives extend shelf life — many shoppers prefer to limit these.',
      ingredients: preservatives.slice(0, 4),
      severity: 'medium',
    })
  }

  const emulsifiers = matchIngredients(names, EMULSIFIER_RE)
  if (emulsifiers.length > 0 || (scoringData?.emulsifierCount ?? 0) > 0) {
    concerns.push({
      id: 'emulsifiers',
      title: 'Emulsifiers & texture agents',
      detail: 'Keep oil and water blended and stabilize texture — a sign of engineered processing.',
      ingredients: emulsifiers.slice(0, 4),
      severity: 'medium',
    })
  }

  const artificialSweeteners = matchIngredients(names, ARTIFICIAL_SWEETENER_RE)
  if (artificialSweeteners.length > 0 || (scoringData?.sweetenerCount ?? 0) > 0) {
    concerns.push({
      id: 'artificial_sweeteners',
      title: 'Artificial sweeteners',
      detail: 'Non-nutritive sweeteners used instead of sugar in many diet products.',
      ingredients: artificialSweeteners.slice(0, 4),
      severity: 'high',
    })
  }

  const artificialColors = matchIngredients(names, ARTIFICIAL_COLOR_RE)
  if (artificialColors.length > 0) {
    concerns.push({
      id: 'artificial_colors',
      title: 'Artificial colors',
      detail: 'Synthetic dyes for appearance — often avoided in cleaner-label products.',
      ingredients: artificialColors.slice(0, 4),
      severity: 'high',
    })
  }

  const industrialSweeteners = matchIngredients(names, INDUSTRIAL_SWEETENER_RE)
  if (industrialSweeteners.length > 0 || (scoringData?.industrialSweetenerCount ?? 0) > 0) {
    concerns.push({
      id: 'industrial_sweeteners',
      title: 'Industrial sweeteners',
      detail: 'Refined syrups and maltodextrin spike sweetness without whole-food fiber.',
      ingredients: industrialSweeteners.slice(0, 4),
      severity: 'medium',
    })
  }

  if ((scoringData?.hydrogenatedOilCount ?? 0) > 0) {
    const hydrogenated = matchIngredients(names, /\b(partially hydrogenated|hydrogenated)\b/i)
    concerns.push({
      id: 'hydrogenated_oils',
      title: 'Hydrogenated oils',
      detail: 'Chemically altered fats used for stability — widely flagged in nutrition guidance.',
      ingredients: hydrogenated.slice(0, 3),
      severity: 'high',
    })
  }

  return concerns
}

export function formulaConcernHeadline(concerns: FormulaConcernCategory[]): string | null {
  if (!concerns.length) return null
  const titles = concerns.slice(0, 2).map((c) => c.title.toLowerCase())
  if (concerns.length === 1) return `Contains ${titles[0]}`
  if (concerns.length === 2) return `Contains ${titles[0]} and ${titles[1]}`
  return `Contains ${titles[0]}, ${titles[1]}, and more`
}
