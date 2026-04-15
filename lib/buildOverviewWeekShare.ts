import { Platform } from 'react-native'
import { getStorePageUrlForShare } from './appStoreLinks'

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

export function buildOverviewWeekShareContent(params: {
  weekLabel: string
  scansThisWeek: number
  flaggedIngredientsThisWeek: number
  avgFit: number | null
  topName: string | null
  topCount: number
}): { message: string; title: string; url?: string } {
  const link = getStorePageUrlForShare()
  const {
    weekLabel,
    scansThisWeek,
    flaggedIngredientsThisWeek,
    avgFit,
    topName,
    topCount,
  } = params

  const scansW = plural(scansThisWeek, 'scan', 'scans')
  const ingW = plural(flaggedIngredientsThisWeek, 'ingredient', 'ingredients')

  let body: string
  if (scansThisWeek === 0) {
    body = `My Fillr week (${weekLabel})\n\nNo scans logged this week — I still use Fillr to match ingredients to my profile.`
  } else if (flaggedIngredientsThisWeek === 0) {
    body = `My Fillr week (${weekLabel})\n\nClean streak: zero flagged ingredients across ${scansThisWeek} ${scansW}.`
  } else {
    const fitLine =
      avgFit != null && avgFit > 0 ? `\nAvg Fillr Fit: ${avgFit}` : ''
    const topLine =
      topName && topCount > 0
        ? `\nMost flagged: ${topName} (${topCount === 1 ? 'once' : `${topCount}×`})`
        : ''
    body = `My Fillr week (${weekLabel})\n\n${flaggedIngredientsThisWeek} flagged ${ingW} across ${scansThisWeek} ${scansW}.${fitLine}${topLine}`
  }

  const cta = '\n\nScan barcodes with Fillr — tailored to your ingredients & allergies.'

  if (Platform.OS === 'ios') {
    return {
      message: `${body}${cta}`,
      url: link,
      title: 'My week on Fillr',
    }
  }

  return {
    message: `${body}${cta}\n\n${link}`,
    title: 'My week on Fillr',
  }
}
