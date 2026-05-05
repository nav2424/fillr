type EventRow = {
  event_name: string
  payload_json: Record<string, unknown> | null
  created_at: string
}

export type GrowthDashboardModel = {
  windowLabel: string
  funnel: {
    onboardingCompleted: number
    scanStarted: number
    scanSucceeded: number
    paywallShown: number
    paywallPurchased: number
    paywallPurchaseRate: number
  }
  quality: {
    renderedScans: number
    weakCopyScans: number
    weakCopyRate: number
    weakCopyIngredients: number
    totalIngredients: number
  }
  monetization: {
    restoreTapped: number
    restoreSucceeded: number
    restoreSuccessRate: number
  }
}

function pct(numerator: number, denominator: number): number {
  if (!denominator) return 0
  return Number(((numerator / denominator) * 100).toFixed(1))
}

export function buildGrowthDashboardModel(rows: EventRow[], days: number): GrowthDashboardModel {
  const count = (name: string) => rows.filter((r) => r.event_name === name).length
  const scanCopyRows = rows.filter((r) => r.event_name === 'scan_copy_quality')
  const renderedRows = rows.filter((r) => r.event_name === 'scan_result_rendered')

  const weakCopyIngredients = scanCopyRows.reduce((sum, r) => {
    const v = Number((r.payload_json?.weak_copy_count as number | undefined) ?? 0)
    return sum + (Number.isFinite(v) ? v : 0)
  }, 0)
  const totalIngredients = scanCopyRows.reduce((sum, r) => {
    const v = Number((r.payload_json?.total_ingredients as number | undefined) ?? 0)
    return sum + (Number.isFinite(v) ? v : 0)
  }, 0)
  const weakCopyScans = scanCopyRows.reduce((sum, r) => {
    const hasWeak = Boolean(r.payload_json?.has_weak_copy)
    return sum + (hasWeak ? 1 : 0)
  }, 0)

  const onboardingCompleted = count('onboarding_completed')
  const scanStarted = count('scan_started')
  const scanSucceeded = count('scan_succeeded')
  const paywallShown = count('paywall_shown')
  const paywallPurchased = count('paywall_purchased')
  const restoreTapped = count('restore_purchases_tapped')
  const restoreSucceeded = count('restore_purchases_succeeded')

  return {
    windowLabel: `Last ${days} days`,
    funnel: {
      onboardingCompleted,
      scanStarted,
      scanSucceeded,
      paywallShown,
      paywallPurchased,
      paywallPurchaseRate: pct(paywallPurchased, paywallShown),
    },
    quality: {
      renderedScans: renderedRows.length,
      weakCopyScans,
      weakCopyRate: pct(weakCopyScans, Math.max(scanCopyRows.length, renderedRows.length)),
      weakCopyIngredients,
      totalIngredients,
    },
    monetization: {
      restoreTapped,
      restoreSucceeded,
      restoreSuccessRate: pct(restoreSucceeded, restoreTapped),
    },
  }
}

