import { attachFillrFitToScanResult, getFillrScoringProfileHash } from './attachFillrFit'
import { dietSlugToPreferenceKey, dietSlugToSensitivityKey, getUserProfileForScan } from './getUserProfileForScan'
import { personalizeScanResult, refreshScanProfileSafety } from './personalizationEngine'
import { useScanHistoryStore } from '../store/scanHistoryStore'

const RESCORE_STEP_MS = 50

/**
 * Recompute Fillr Fit for every saved scan using the latest profile (background-friendly).
 */
export async function rescoreAllSavedScanFits(): Promise<void> {
  const dietary = await getUserProfileForScan()
  const profileHash = getFillrScoringProfileHash(dietary)
  const userProfile = {
    allergies: dietary.allergies,
    sensitivities: dietary.sensitivities
      .map((s) => dietSlugToSensitivityKey(s) ?? s)
      .filter(Boolean),
    preferences: (dietary.scoringPreferenceKeys?.length ? dietary.scoringPreferenceKeys : dietary.preferences)
      .map((p) => dietSlugToPreferenceKey(p) ?? p)
      .filter(Boolean),
    goal: dietary.goal ?? '',
    celiacStrictGluten: Boolean(dietary.celiacStrictGluten),
  }
  const { scans, updateScanResultByProductId } = useScanHistoryStore.getState()

  for (const rec of scans) {
    if (!rec.result) continue
    if (rec.result.scoringFrozenAt && rec.result.scoringProfileHash === profileHash) continue
    await new Promise((r) => setTimeout(r, RESCORE_STEP_MS))
    const safetyFresh = refreshScanProfileSafety(rec.result, userProfile)
    const personalized = personalizeScanResult(safetyFresh, userProfile)
    const next = attachFillrFitToScanResult(personalized, dietary)
    updateScanResultByProductId(rec.productId, next)
  }
}
