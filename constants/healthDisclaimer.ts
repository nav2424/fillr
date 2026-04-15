/**
 * Non-medical positioning for store review, liability, and user expectations.
 * Allergen / health apps should consistently state: not medical advice, verify the label, consult professionals.
 */

/** Dense one-liner — scan tab, tight footers */
export const HEALTH_DISCLAIMER_MICRO =
  'Not medical advice — always read the physical package label and confirm with a professional when it matters for your health.'

/** Standard footer — product screen, home if needed */
export const HEALTH_DISCLAIMER_SHORT =
  'Fillr is informational only—not medical advice. Always read the physical label and consult a qualified professional for allergies, celiac disease, or other medical diets.'

/** Product screen — one footer line (replaces stacked short + celiac + high-risk notes). */
export const HEALTH_DISCLAIMER_PRODUCT_SINGLE_LINE =
  'Informational only—not medical advice or a medical device. Always verify the physical label; data may be incomplete. Consult a professional when health decisions matter.'

/** First-scan education banner */
export const HEALTH_DISCLAIMER_FIRST_SCAN =
  "Fillr uses food databases and AI; it is not a medical device. For serious allergies or medical conditions, always verify the official package label and follow your clinician's guidance."

/**
 * Onboarding disclaimer screen: text before the Terms link.
 * JSX should append the linked “Terms of Service” and a period.
 */
export const HEALTH_DISCLAIMER_ONBOARDING_PREFIX =
  'Fillr is an informational tool only. It is not a medical device and does not replace reading the actual product label, manufacturer allergen statements, or advice from a qualified health professional. '

export const HEALTH_DISCLAIMER_ONBOARDING_SUFFIX = 'Use of Fillr is subject to our '

/** Profile → “About Fillr’s ratings” modal — closing block (after methodology paragraphs). */
export const HEALTH_DISCLAIMER_RATINGS_MODAL_CLOSE =
  '\n\nFillr is not a medical device. Scan results, allergen flags, and ingredient ratings are informational only. They are not a substitute for reading the official package label or seeking professional medical or dietary advice—especially for food allergies, celiac disease, or other medical conditions.'

/** Celiac Mode — product screen */
export const CELIAC_MODE_DISCLAIMER =
  "🌾 Celiac Mode interprets label text only; it is not a medical guarantee. Data may be incomplete or outdated. Always verify the physical package and follow your clinician's guidance."

/** Severe allergy / celiac profile nudge on product */
export const HEALTH_DISCLAIMER_HIGH_RISK_NOTE =
  '🏷️ Always verify the physical label. Fillr is not a medical device and does not replace professional advice.'
