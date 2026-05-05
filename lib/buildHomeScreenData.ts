import type { ScanRecord } from '../store/scanHistoryStore'
import type { CeliacResult, IngredientRating, SafetyStatus, ScanIngredientSource } from '../types'
import { GOAL_OPTIONS, PREFERENCE_OPTIONS, SENSITIVITY_OPTIONS } from '../types'
import { getAllergyLabel } from './knownAllergens'
import { getWeekBounds, formatWeekRangeLabel, isInWeek } from './overviewAnalytics'
import { parseScanHistoryDate, scanHistoryRecordHasReliableTime } from './parseScanHistoryDate'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export type HomeRecentScan = {
  id: string
  productId: string
  productName: string
  date: string
  source?: ScanIngredientSource
  safetyStatus: SafetyStatus
  celiac?: CeliacResult
  scannedAtLabel: string
}

export type HomeWorstOffender = {
  rank: number
  ingredientName: string
  scanCountThisWeek: number
}

export type HomeAlert = {
  id: string
  title: string
  subtitle: string
}

export type HomeGreeting = {
  label: string
  flagCount: number
}

export type HomeWatchlistCard = {
  id: string
  title: string
  subtitle: string
  tag: string
  variant: 'allergy' | 'sensitivity' | 'preference' | 'goal'
}

export type HomeScreenData = {
  firstName: string
  greetingTitle: string
  headlineLead: string
  headlineAccent: string
  subhead: string
  greeting: HomeGreeting
  watchlistCards: HomeWatchlistCard[]
  alerts: HomeAlert[]
  recentScans: HomeRecentScan[]
}

export type HomePrefsSnapshot = {
  allergies: string[]
  sensitivities: string[]
  preferences: string[]
  goalKey: string
  /** Mirrors `userStore.celiacStrictGluten` — not part of `allergies[]` but shown under Allergies on Profile. */
  celiacStrictGluten?: boolean
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function greetingTimePhrase(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function greetingLabelFromHour(hour: number): string {
  if (hour < 12) return 'GOOD MORNING'
  if (hour < 18) return 'GOOD AFTERNOON'
  return 'GOOD EVENING'
}

function firstNameFromFull(full: string | null | undefined): string {
  const t = (full ?? '').trim()
  if (!t) return 'there'
  const first = t.split(/\s+/)[0] ?? 'there'
  if (!first) return 'there'
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
}

function getSensitivityLabel(key: string): string {
  const hit = SENSITIVITY_OPTIONS.find((o) => o.key === key)
  return hit?.label ?? key.replace(/_/g, ' ')
}

function getGoalLabel(key: string): string {
  const hit = GOAL_OPTIONS.find((o) => o.key === key)
  return hit?.label ?? 'Your goal'
}

function getPreferenceLabel(key: string): string {
  const hit = PREFERENCE_OPTIONS.find((o) => o.key === key)
  return hit?.label ?? key.replace(/_/g, ' ')
}

export function scoreFromScan(scan: ScanRecord): number {
  const s = scan.result?.fillrFit?.score
  if (typeof s === 'number' && Number.isFinite(s)) {
    return Math.round(Math.max(0, Math.min(100, s)))
  }
  if (scan.safetyStatus === 'SAFE') return 78
  if (scan.safetyStatus === 'CAUTION') return 58
  if (scan.safetyStatus === 'UNSAFE') return 38
  return 55
}

function normalizeIngredientKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function isWatchlistRating(r: IngredientRating | undefined): boolean {
  return r === 'concerning' || r === 'avoid'
}

function formatScannedAt(dateStr: string): string {
  const d = parseScanHistoryDate(dateStr)
  if (!d) return 'Recently scanned'
  const now = new Date()
  const startToday = startOfLocalDay(now)
  const yest = new Date(startToday)
  yest.setDate(yest.getDate() - 1)
  const hasClock = scanHistoryRecordHasReliableTime(dateStr)
  const timeSuffix = hasClock
    ? ` • ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
    : ''
  if (d >= startToday) return `Scanned today${timeSuffix}`
  if (d >= yest) return `Scanned yesterday${timeSuffix}`
  const day = `${MONTHS[d.getMonth()]} ${d.getDate()}`
  return `Scanned ${day}${timeSuffix}`
}

/**
 * Top ingredients (concerning/avoid) by how many distinct scans in the calendar week contained them (current user only).
 */
export function buildWorstOffendersThisWeek(
  scans: ScanRecord[],
  ref: Date = new Date(),
  limit: number = 4
): HomeWorstOffender[] {
  const { start, end } = getWeekBounds(ref)
  const weekScans = scans.filter((s) => {
    const d = parseScanHistoryDate(s.date)
    return d && !Number.isNaN(d.getTime()) && isInWeek(d, start, end)
  })

  const scanIdsByKey = new Map<string, Set<string>>()
  const displayNameByKey = new Map<string, string>()

  for (const scan of weekScans) {
    const lines = scan.result?.ingredientBreakdown ?? []
    const seenInThisScan = new Set<string>()
    for (const line of lines) {
      const rating = (line.ingredientRating ?? 'okay') as IngredientRating
      if (!isWatchlistRating(rating)) continue
      const raw = (line.name ?? '').trim()
      if (!raw) continue
      const key = normalizeIngredientKey(raw)
      if (seenInThisScan.has(key)) continue
      seenInThisScan.add(key)
      if (!displayNameByKey.has(key)) displayNameByKey.set(key, raw)
      let set = scanIdsByKey.get(key)
      if (!set) {
        set = new Set()
        scanIdsByKey.set(key, set)
      }
      set.add(scan.id)
    }
  }

  const sorted = [...scanIdsByKey.entries()].sort((a, b) => {
    const diff = b[1].size - a[1].size
    if (diff !== 0) return diff
    const na = displayNameByKey.get(a[0]) ?? a[0]
    const nb = displayNameByKey.get(b[0]) ?? b[0]
    return na.localeCompare(nb)
  })

  const cap = Math.max(1, Math.floor(limit))
  return sorted.slice(0, cap).map(([key, idSet], i) => ({
    rank: i + 1,
    ingredientName: displayNameByKey.get(key) ?? key,
    scanCountThisWeek: idSet.size,
  }))
}

export function formatWeekRangeChip(ref: Date = new Date()): string {
  const { start, end } = getWeekBounds(ref)
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${MONTHS[start.getMonth()]} ${start.getDate()}–${end.getDate()}`
  }
  return formatWeekRangeLabel(start, end)
}

function countFlagsSinceYesterday(scans: ScanRecord[]): number {
  const today = startOfLocalDay(new Date())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  let n = 0
  for (const s of scans) {
    const d = parseScanHistoryDate(s.date)
    if (!d || d < yesterday) continue
    const allergens = s.result?.matchedAllergens?.length ?? 0
    if (allergens > 0 || s.safetyStatus === 'UNSAFE') n++
  }
  return n
}

function buildAlerts(scans: ScanRecord[]): HomeAlert[] {
  for (const s of scans) {
    const allergens = s.result?.matchedAllergens
    if (allergens && allergens.length > 0) {
      const first = allergens[0]
      return [
        {
          id: `allergen-${s.id}`,
          title: `${first.allergenName} detected`,
          subtitle: `Found in “${s.productName.slice(0, 52)}${s.productName.length > 52 ? '…' : ''}”. Review before eating.`,
        },
      ]
    }
  }
  return []
}

function buildWatchlistCards(prefs: HomePrefsSnapshot | undefined): HomeWatchlistCard[] {
  const out: HomeWatchlistCard[] = []
  const a = prefs?.allergies ?? []
  const sens = prefs?.sensitivities ?? []
  const pref = prefs?.preferences ?? []
  const goal = prefs?.goalKey ?? ''

  if (prefs?.celiacStrictGluten) {
    out.push({
      id: 'wl-celiac',
      title: 'Celiac Mode',
      subtitle: 'Strict gluten checks on every scan.',
      tag: 'Celiac',
      variant: 'allergy',
    })
  }

  for (const key of a.slice(0, 4)) {
    out.push({
      id: `wl-allergy-${key}`,
      title: getAllergyLabel(key),
      subtitle: 'We flag matches on every scan.',
      tag: 'Allergy',
      variant: 'allergy',
    })
  }
  for (const key of sens.slice(0, 6)) {
    out.push({
      id: `wl-sens-${key}`,
      title: getSensitivityLabel(key),
      subtitle: 'Shown as cautions on your score.',
      tag: 'Sensitivity',
      variant: 'sensitivity',
    })
  }
  for (const key of pref.slice(0, 6)) {
    out.push({
      id: `wl-pref-${key}`,
      title: getPreferenceLabel(key),
      subtitle: 'Used when Fillr scores products.',
      tag: 'Preference',
      variant: 'preference',
    })
  }
  if (goal) {
    out.push({
      id: `wl-goal`,
      title: getGoalLabel(goal),
      subtitle: 'Fillr nudges scores toward this.',
      tag: 'Goal',
      variant: 'goal',
    })
  }
  return out.slice(0, 12)
}

export function buildHomeScreenData(
  fullName: string | null | undefined,
  scans: ScanRecord[],
  prefs?: HomePrefsSnapshot
): HomeScreenData {
  const now = new Date()
  const first = firstNameFromFull(fullName)
  const hour = now.getHours()
  const greetingTitle = `${greetingTimePhrase(hour)}, ${first} 👋`

  const recent = scans.slice(0, 8).map((s) => ({
    id: s.id,
    productId: s.productId,
    productName: s.productName || 'Unknown product',
    date: s.date,
    source: s.source,
    safetyStatus: s.safetyStatus,
    celiac: s.result?.celiac,
    scannedAtLabel: formatScannedAt(s.date),
  }))

  return {
    firstName: first,
    greetingTitle,
    headlineLead: 'Better choices,',
    headlineAccent: 'every day.',
    subhead: 'Scan, decode, and take control of what you eat.',
    greeting: {
      label: greetingLabelFromHour(hour),
      flagCount: countFlagsSinceYesterday(scans),
    },
    watchlistCards: buildWatchlistCards(prefs),
    alerts: buildAlerts(scans),
    recentScans: recent,
  }
}
