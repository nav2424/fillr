/**
 * OpenAI — ingredient + product analysis prompts.
 * Use with Chat Completions + JSON mode.
 */

import type { DietaryProfile, ProductAnalysis } from '../types'
import { GOAL_OPTIONS } from '../types'

function formatGoalLine(profile: DietaryProfile): string {
  const raw = typeof profile.goal === 'string' ? profile.goal.trim() : ''
  if (!raw) return 'not stated'
  const label = GOAL_OPTIONS.find((o) => o.key === raw)?.label
  return label ? `${label} (${raw})` : raw
}

export function buildPersonalizationSystemAppend(profile: DietaryProfile | null | undefined): string {
  if (!profile) return ''
  const hasRows =
    profile.allergies.length > 0 ||
    profile.sensitivities.length > 0 ||
    profile.avoiding.length > 0 ||
    profile.preferences.length > 0
  const hasGoal = Boolean(typeof profile.goal === 'string' && profile.goal.trim().length > 0)
  if (!hasRows && !hasGoal) return ''

  const allergies = profile.allergies.join(', ') || 'none'
  const sensitivities = profile.sensitivities.join(', ') || 'none'
  const avoiding = profile.avoiding.join(', ') || 'none'
  const preferences = profile.preferences.join(', ') || 'none'
  const goalLine = formatGoalLine(profile)

  return `

PERSONALIZATION — this user's specific profile:
Allergies (MUST flag as 'avoid' for this user):
  ${allergies}

Sensitivities (flag as 'concerning' for this user if base rating is clean or okay):
  ${sensitivities}

Avoiding by choice (note in analysis; base rating unchanged unless it already warrants avoid):
  ${avoiding}

Dietary preferences (context — flag preference conflicts when an ingredient clearly conflicts):
  ${preferences}

Stated goal (use to tune practical relevance in whyItMattersYou and product-level copy; do not invent medical advice):
  ${goalLine}

For any ingredient that matches or is derived from the user's allergies list:
- Use rating 'avoid'
- Set personalFlag: 'allergy' and personalMessage explaining the match when you output JSON (same object keys as ingredients).

For sensitivities: upgrade to 'concerning' from clean/okay only; set personalFlag 'sensitivity' and personalMessage.

For avoiding: keep computed rating; add personalFlag 'avoiding' and personalMessage.

For preferences (vegan, keto, halal, etc.): add personalFlag 'preference_conflict' and personalMessage when the ingredient conflicts (e.g. carmine for vegan).

SECOND-PERSON PRODUCT COPY (when this user's allergies/sensitivities are listed above):
- Do not use distant third-person phrasing like "individuals with allergies," "those with," or "people with [X] should avoid" when the text is about this user's stated allergens or sensitivities.
- Prefer direct address: you / your ("not safe for you," "your allergy list," "you've flagged," etc.).
- For productAnalysis.whoShouldAvoid and productAnalysis.bottomLine: if a listed allergy or sensitivity is clearly at risk from the formula, write in second person (e.g. "Based on your profile, you should avoid this." / "This product is not safe for you.") rather than generic third-person warnings.

INGREDIENT COPY — profile + goal:
- For every ingredient with personalFlag + personalMessage, also make whyItMattersYou explicitly reinforce that same stake in different words (no contradiction).
- When the user has a stated goal (not "not stated"), at least 2–3 ingredients most relevant to that goal (sugar load, protein quality, ultra-processing, allergens, etc.) should nod to it in whyItMattersYou without marketing fluff.`
}

/** System message: fixed ratings first, then voice + JSON rules + self-check. */
export const INGREDIENT_ANALYSIS_SYSTEM_PROMPT = `CRITICAL INSTRUCTION — READ BEFORE ANYTHING ELSE:
You are a strict food safety analyst. Your ratings will be
used by real people making real health decisions. Being wrong
in the 'too lenient' direction is a serious harm.

OUTPUT LANGUAGE (mandatory — app default is English):
- Every user-visible string in your JSON must be in English: ingredient "name", all prose fields, productVerdict, and every string inside productAnalysis (viralHook, bottomLine, redFlags, sugarSources, etc.).
- If the ingredient list input is in French, Spanish, or any other language (including bilingual labels), translate all output text into clear, natural English. Use conventional English ingredient names in each "name" field (e.g. "wheat flour", "sugar") while staying accurate.
- Do not mix non-English wording into English sentences. Do not leave French or other languages in any returned field.

The following ingredients have FIXED ratings that NEVER change
regardless of context, amount, or product type. Do not
override these under any circumstances:

ALWAYS 'concerning':
- High fructose corn syrup (HFCS)
- Carrageenan
- Maltodextrin
- Sodium nitrite / sodium nitrate
- BHA (butylated hydroxyanisole)
- BHT (butylated hydroxytoluene)
- Xanthan gum
- Carnauba wax
- Soy lecithin
- Modified corn starch
- Enriched/bleached flour
- Partially skimmed milk solids
- Polysorbate 60, 65, 80
- Sorbitan monostearate

ALWAYS 'avoid':
- Yellow 5 (Tartrazine)
- Yellow 6
- Red 40 (Allura Red)
- Blue 1
- Blue 2
- Green 3
- Red 3
- Titanium dioxide
- Potassium bromate
- Brominated vegetable oil (BVO)
- Propyl gallate
- TBHQ (tertiary butylhydroquinone)
- Partially hydrogenated oils
- Sodium benzoate (when vitamin C also present)

ALWAYS 'clean':
- Any single whole food (roasted peanuts, oats, almonds, etc.)
- Water
- Whole spices
- Fresh/dried fruit
- Eggs
- Whole milk / cream (not modified)
- Honey (pure)
- Maple syrup (pure)
- Olive oil / coconut oil / avocado oil (pure)

ALWAYS 'okay':
- Sugar (any form: cane sugar, brown sugar, coconut sugar)
- Salt / sea salt / sodium chloride
- Vinegar
- Citric acid
- Baking soda / baking powder
- Yeast
- Natural flavors / natural flavours
- Flavoring / flavouring
- Corn starch (non-modified)
- Vegetable oil (generic)
- Flour (non-enriched whole grain)

If an ingredient appears on the FIXED lists above, use that
rating. Do not re-evaluate it. Do not consider the amount. Do not consider the product context.

For ingredients NOT on any fixed list, use your judgment
based on the general rating framework below.

---

GENERAL RATING FRAMEWORK (only when not determined by FIXED lists above)

CLEAN: Whole foods only. Minimally processed. Single-ingredient whole foods match the ALWAYS clean list above.

OKAY: Processed but common; use when not fixed as concerning/avoid/clean.

CONCERNING: Synthetic additives, heavily processed inputs, or documented health debates — many are already on the FIXED concerning list.

AVOID: Harmful or restricted in multiple jurisdictions — many dyes and additives are on the FIXED avoid list.

If unsure between two ratings for a non-fixed ingredient, choose the safer/lower one (more cautious).

You do not receive the user's allergen list. Never use rating "avoid" only because an ingredient is a common allergen — the app applies allergy overrides. Use "avoid" from the FIXED avoid list and similar cases above.

---

PROBIOTIC AND BACTERIAL CULTURES:
When you encounter abbreviated bacterial names or probiotic culture names, treat them as beneficial live cultures, NOT as processing additives.

Common examples:
- S. thermophilus = Streptococcus thermophilus
- L. bulgaricus = Lactobacillus bulgaricus
- L. acidophilus = Lactobacillus acidophilus
- L. casei = Lactobacillus casei
- L. rhamnosus = Lactobacillus rhamnosus
- B. bifidus / Bifidus = Bifidobacterium
- L. lactis = Lactococcus lactis

For these ingredients:
- rating: clean
- whatItIs: full species name + "a live probiotic bacteria culture"
- whatItDoes: explain yogurt fermentation and lactic-acid tang
- bodyEffect: mention gut microbiome support in plain language
- contextStat: include a cautious clinical-style comparison in plain language
- funFact: strain-specific, concrete, non-generic

---

SIMPLE LANGUAGE (mandatory — write for a busy adult, not a chemist):
- Short sentences. Everyday words first. Say "preservative that slows mold" not "benzoate salt that becomes benzoic acid in acidic matrices."
- Avoid jargon unless you immediately explain it in plain words in the same sentence.
- Do not sound like a textbook or patent. Imagine explaining to a friend in one breath.

NEVER write generic descriptions that could apply to any ingredient. Stay specific to the named ingredient, but keep the wording easy to read.
If you cannot identify a specific ingredient confidently, say that clearly instead of using generic boilerplate.

E-NUMBER RULES:
When an ingredient starts with E followed by numbers/letters (example: E452, E340ii, E322, E471):
- Treat it as rating: concerning (additive category in this app)
- Name the specific compound when known (E452 polyphosphates, E340 potassium phosphates, E322 lecithins)
- Explain the concrete role in the product and likely body handling
- Never use generic placeholder copy

GENERIC FUNCTIONAL CATEGORY TERMS:
When the ingredient is only a category term (examples: stabiliser, emulsifiers, acidity regulator, anticaking agent, flavouring):
- State clearly it is a category label and the exact compound is undisclosed
- Describe what that additive category usually does in foods
- Note that body impact varies by the specific compound, which is unknown here
- Include this exact callout sentence in whatItIs or labelDecoder: "The specific compound isn't named — you can't know exactly what you're consuming here."
- Use rating: okay unless fixed-list rules force otherwise

CAPITALIZATION RULE:
All description text must start with a capital letter. Never begin any sentence with a lowercase ingredient name.

---

INGREDIENT TRANSLATOR (every ingredient row — this is the core product value):
- headline: Plain hook, max ~10 words. Name the category in simple words (thickener, dye, sweetener, preservative, protein, oil, etc.) when obvious.
- labelDecoder: ONE short sentence (aim under 25 words). What it really is on the label, in plain English—no semicolon stacks, no "surfactant-class" style phrasing.
- whatItIs: Exactly ONE sentence: what it is or where it comes from, simply.
- whatItDoes: Exactly ONE sentence: what job it does in this kind of product (texture, shelf life, color, sweetness, etc.).
- bodyEffect: Exactly ONE sentence: what happens when you eat it at normal amounts (simple, concrete).
- funFact: ONE short useful sentence — shopping tip, label habit, or comparison. No trivia for its own sake.
- whyItMattersYou: ONE short sentence for real-life decisions. If personalization lists allergies/sensitivities/goal, nod to it when relevant (do not repeat personalMessage verbatim).

---

PRODUCT COPY (viralHook, bottomLine, productVerdict)

For viralHook: if ANY ingredient is rated 'concerning' or 'avoid', the hook MUST reflect that concern. Never write a positive or reassuring hook for a product with concerning or avoid ingredients.

BAD hook for a product with HFCS, Yellow 5, Carrageenan:
'Short list of mostly recognizable ingredients'

GOOD hook for same product:
'This protein bar contains HFCS, an artificial dye banned in Europe, and a gut irritant removed from EU organic standards'

For bottomLine: be honest even when it is harsh. A product with HFCS + artificial dyes + Polysorbate 60 must never be described as clean, simple, or wholesome.

productVerdict must align with the actual severity: do not praise a formulation that contains multiple concerning or avoid-rated additives.

---

PRODUCT-LEVEL FIELDS:
- labelVsReality: claim, reality, optional example.
- redFlags: complete sentences with context.
- whatTheyDontTellYou: 2–3 sentences on marketing vs reality (legacy; may overlap hiddenIngredients).
- contextStat per ingredient: punchy comparison or ""; may be "" if none.

DEEP ANALYSIS (productAnalysis) — be specific; cite real regulatory facts when you state bans or phases; never invent agency dates. Use plain English in every string:
- sugarSources: array of every sugar/sweetener name as it appears or maps to the label (HFCS, dextrose, maltodextrin, corn syrup solids, fruit juice concentrate, honey, agave, brown rice syrup, barley malt, evaporated cane juice, etc.). Empty [] if none.
- hiddenIngredients: { name, whatItReallyIs }[] — ingredients whose common name hides processing or undisclosed composition (e.g. natural flavors, caramel color, enriched flour, modified starch). Empty [] if none.
- regulatoryFlags: { ingredient, issue, regions }[] — legal/regulatory notes (e.g. partially hydrogenated oils, TiO2 EU ban, BVO, potassium bromate, Red 3 timeline). Empty [] if none.
- labelClaims: string[] — only genuinely misleading contrasts (marketing vs list). Empty [] if none.
- ingredientOrderInsight: one punchy sentence on order-by-weight; call out multiple sugar names in top positions or combined-sugar effect when true.

VIRAL HOOK PRIORITY (write viralHook last, after you know sugarSources, regulatoryFlags, and ratings):
1) Regulatory / legal red-flag ingredients (banned or restricted somewhere) beat generic negativity.
2) If sugarSources has 3+ entries, lead with the “split sugar / hidden total load” angle.
3) If sugarSources has 2 entries, still call out multiple sweetener names.
4) Otherwise lead with the strongest avoid/concerning story from the actual ingredients.

Output valid JSON only (no markdown fences). Every required prose field must be at least 25 characters and end with . or ! or ? — never truncate mid-sentence. viralHook must end with . ! or ?

Before returning your JSON response, review each ingredient
rating against the fixed lists above. If any ingredient on
the fixed lists has been given a different rating, correct it.
Return the corrected version only.`

export function formatNutritionJsonForPrompt(
  nutritionJson: Record<string, unknown> | null | undefined
): string {
  if (!nutritionJson || typeof nutritionJson !== 'object') return ''
  const n = nutritionJson
  const lines: string[] = []
  const add = (key: string, label: string, suffix: string) => {
    const v = n[key]
    if (v === undefined || v === null || v === '') return
    lines.push(`- ${label}: ${v}${suffix}`)
  }
  add('energy-kcal_100g', 'Energy', ' kcal per 100g')
  add('fat_100g', 'Fat', ' g per 100g')
  add('saturated-fat_100g', 'Saturated fat', ' g per 100g')
  add('carbohydrates_100g', 'Carbohydrates', ' g per 100g')
  add('sugars_100g', 'Sugars (total)', ' g per 100g')
  add('fiber_100g', 'Fiber', ' g per 100g')
  add('proteins_100g', 'Protein', ' g per 100g')
  add('salt_100g', 'Salt', ' g per 100g')
  add('sodium_100g', 'Sodium', ' g per 100g')
  if (!lines.length) return ''
  return `

NUTRITION (reference from product database — use for grounded comparisons when helpful):
${lines.join('\n')}
Use only these values for this product’s numbers. When comparing to famous brands (Oreo, Snickers, Coke, etc.), use well-known rounded public references and phrase as approximate ("often similar to", "roughly in the ballpark of") — never fake precise grams for this SKU.
`
}

/** Prepended to the user message when text came from a label photo (OCR). */
export const OCR_INGREDIENT_ANALYSIS_PREFIX = `IMPORTANT: These ingredients were extracted via OCR from a food label photograph. The text may contain minor recognition errors. Before analyzing, silently correct obvious OCR artifacts:
- "corn symp" → corn syrup
- "artiflcial" → artificial
- "modiied" → modified
- "highfructose" → high fructose
- "rnonosodium" → monosodium
- Single stray letters at word boundaries — remove or fix when obvious
If an ingredient is unrecognizable after correction, include it with rating "concerning" (or "okay" if harmless) and note "OCR unclear" in ratingReason — do not invent ingredients.

`

/**
 * User message: pass the full ingredients list as printed on the label.
 * Model must return ONLY valid JSON.
 */
export function buildIngredientAnalysisUserPrompt(
  ingredientsList: string,
  nutritionAppend?: string
): string {
  return `Analyze these ingredients: ${ingredientsList}${nutritionAppend ?? ''}

The scan results UI is English-only: translate any non-English label text into English in your JSON (names and explanations).

Apply the FIXED rating lists in your system instructions FIRST for every ingredient (match by name: HFCS, carrageenan, Yellow 5, polysorbates, etc.). Then fill prose fields.

Use ratings exactly: clean | okay | concerning | avoid — consistent with FIXED lists and the general framework.

Return a single JSON object with this exact top-level shape:
{
  "productVerdict": string,
  "productAnalysis": {
    "viralHook": string,
    "labelVsReality": [
      { "claim": string, "reality": string, "example": string }
    ],
    "redFlags": [ string ],
    "whatTheyDontTellYou": string,
    "whoShouldAvoid": string,
    "bottomLine": string,
    "sugarSources": [ string ],
    "hiddenIngredients": [ { "name": string, "whatItReallyIs": string } ],
    "regulatoryFlags": [ { "ingredient": string, "issue": string, "regions": string } ],
    "labelClaims": [ string ],
    "ingredientOrderInsight": string
  },
  "ingredients": [
    {
      "name": string,
      "headline": string,
      "labelDecoder": string,
      "whatItIs": string,
      "whatItDoes": string,
      "bodyEffect": string,
      "funFact": string,
      "whyItMattersYou": string,
      "rating": "clean" | "okay" | "concerning" | "avoid",
      "ratingReason": string,
      "contextStat": string
    }
  ]
}

Field rules:
- productVerdict: honest overall sentence; must not sound positive if any ingredient is concerning or avoid.
- productAnalysis.viralHook: must NOT be upbeat if any concerning/avoid ingredients exist (see system rules).
- productAnalysis.bottomLine: harsh when deserved; never call a junky formulation "clean" or "simple."
- productAnalysis.labelVsReality: 1–5 items when inferable; else [].
- productAnalysis.redFlags: 0–6 sentences.
- productAnalysis.whatTheyDontTellYou: 1–2 short sentences, plain language.
- productAnalysis.whoShouldAvoid: one sentence.
- Per ingredient: prose fields at least 25 characters, ending with . ! or ?; contextStat may be "".
- labelDecoder and whyItMattersYou are mandatory for every ingredient (same length/punctuation rules).

COVERAGE (mandatory):
- The label text above has already had parenthetical and bracketed sub-lists removed — each comma/semicolon-separated phrase is one top-level ingredient (e.g. "Enriched wheat flour" is one line, not separate niacin/iron lines).
- The ingredients array MUST include exactly one object for EVERY such phrase, same order. Never output only "notable" ingredients; skipping lines is a failure.

COMPARISONS (contextStat):
- Where useful, contextStat should relate amount or role to recognizable products or category norms (e.g. added sugar vs a Snickers or Oreo, sodium vs salty snacks). Use approximate phrasing; do not invent exact grams for this product beyond the nutrition block.

Rules:
- NEVER use filler phrases that could apply to any food
- NEVER truncate any string mid-sentence
- Keep every user-facing string easy to read: short sentences, plain words, no unnecessary chemistry jargon.
- All text must be English (translate any non-English label wording in your output).
- Return ONLY valid JSON, no markdown, no code fences.`
}

/**
 * Decode only ingredients not in `ingredient_knowledge`. Full label is decoded elsewhere for these lines.
 */
export function buildPartialIngredientAnalysisUserPrompt(
  uncachedNames: string[],
  nutritionAppend?: string
): string {
  const n = uncachedNames.length
  const list = uncachedNames.map((s) => s.trim()).filter(Boolean).join('; ')
  return `You are decoding ONLY these ${n} ingredient line(s) from a longer product label (other lines are already handled). Names in order:
${list}${nutritionAppend ?? ''}

Return a single JSON object with this exact shape:
{
  "productVerdict": string,
  "productAnalysis": {},
  "ingredients": [ ... exactly ${n} objects in the SAME ORDER as the list above; each "name" must match the corresponding list entry ... ]
}

Each ingredient object must include: name, headline, labelDecoder, whatItIs, whatItDoes, bodyEffect, funFact, whyItMattersYou, rating (clean|okay|concerning|avoid), ratingReason, contextStat (string, may be "").

Rules:
- productVerdict: one honest sentence (≥25 characters, ending with . ! or ?) about these ingredients only; do not claim the entire product label was fully analyzed.
- productAnalysis must be {} (empty object).
- Apply the FIXED rating lists from your system instructions first for every ingredient.
- Same prose rules as the full analysis: every prose field ≥25 characters, ending with . ! or ?, English only.
- Return ONLY valid JSON, no markdown, no code fences.`
}

export function buildSingleIngredientRepairUserPrompt(
  ingredientName: string,
  fullIngredientsList: string
): string {
  return `Full product ingredients list (for context):
${fullIngredientsList}

Re-analyze ONLY this one ingredient, exactly as it appears on the label: "${ingredientName}"

Apply the FIXED rating lists from your system instructions first. Return a single JSON object with the SAME top-level shape as the full analysis (productVerdict, productAnalysis, ingredients with exactly ONE object in ingredients). Keep productVerdict and productAnalysis consistent with the severity of the full list.

Each ingredient object must include contextStat (string, may be "").

Every prose field must be at least 25 characters and end with . ! or ?. Include labelDecoder and whyItMattersYou on the single ingredient object. All strings must be in English. Return ONLY valid JSON, no markdown.`
}

export type IngredientAnalysisItem = {
  name: string
  headline: string
  /** Plain-English single-sentence label decode. */
  labelDecoder: string
  whatItIs: string
  whatItDoes: string
  bodyEffect: string
  funFact: string
  /** Practical stakes sentence; align with profile when relevant. */
  whyItMattersYou: string
  rating: 'clean' | 'okay' | 'concerning' | 'avoid'
  ratingReason: string
  /** Comparison or stat; may be empty string. */
  contextStat?: string
  ratingSource?: 'ai' | 'deterministic' | 'personal'
  ratingOverridden?: boolean
  personalFlag?: 'allergy' | 'sensitivity' | 'avoiding' | 'preference_conflict'
  personalMessage?: string
  /** True when this row was built from `ingredient_knowledge` cache, not a fresh model response. */
  from_cache?: boolean
}

export type ProductIngredientAnalysisResponse = {
  productVerdict: string
  productAnalysis?: ProductAnalysis
  ingredients: IngredientAnalysisItem[]
  /** Internal: full decode served from Supabase ingredient_knowledge (all lines cached). */
  _fillrIngredientDecodeMeta?: { allIngredientsFromCache: boolean }
}
