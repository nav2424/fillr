import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeOverviewRows } from './mergeOverviewRows'
import type { OverviewScanRow } from './overviewAnalytics'
import type { ScanResult } from '../types'

function row(productId: string, createdAt: string): OverviewScanRow {
  const result: ScanResult = {
    product: {
      id: productId,
      barcode: productId,
      name: productId,
      brand: '',
      ingredientText: '',
      source: 'test',
      createdAt: '',
      updatedAt: '',
    },
    safetyStatus: 'SAFE',
    matchedAllergens: [],
    matchedSensitivities: [],
    smartSummary: '',
    ingredientBreakdown: [],
    insights: [],
  }
  return { createdAt: new Date(createdAt), result }
}

test('mergeOverviewRows keeps newer local scans when remote history exists', () => {
  const remote = [row('remote-old', '2026-06-17T10:00:00.000Z')]
  const local = [row('local-new', '2026-06-17T11:00:00.000Z')]

  const merged = mergeOverviewRows(local, remote)

  assert.deepEqual(
    merged.map((r) => r.result.product.id),
    ['local-new', 'remote-old']
  )
})

test('mergeOverviewRows lets remote replace the same locally persisted scan', () => {
  const remote = [row('same-product', '2026-06-17T11:00:10.000Z')]
  const local = [row('same-product', '2026-06-17T11:00:00.000Z')]

  const merged = mergeOverviewRows(local, remote)

  assert.equal(merged.length, 1)
  assert.equal(merged[0].createdAt.toISOString(), '2026-06-17T11:00:10.000Z')
})
