/**
 * The pure part of the Filecoin module: turning proof state into the words the
 * proof panel shows. Anything that talks to Calibration is exercised by
 * `scripts/spike-calibration.ts`.
 */

import { describe, expect, it } from 'vitest'
import { describeProof, type StorageStatus } from './filecoin.js'

const NOW = new Date('2026-09-11T12:00:00Z')

function status(overrides: Partial<StorageStatus> = {}): StorageStatus {
  return {
    lastProven: new Date('2026-09-11T11:22:00Z'),
    nextProofDue: new Date('2026-09-12T11:00:00Z'),
    isProofOverdue: false,
    retrievalUrl: null,
    ...overrides,
  }
}

describe('describeProof', () => {
  it('says how long ago the last proof landed', () => {
    expect(describeProof(status(), NOW).lastProven).toBe('38 min ago')
  })

  it('says how long until the next one is due', () => {
    expect(describeProof(status(), NOW).nextProofDue).toBe('in about 23 h')
  })

  it('says a fresh data set has not been proven rather than showing a zero', () => {
    expect(describeProof(status({ lastProven: null }), NOW).lastProven).toBe('not proven yet')
  })

  it('says nothing is scheduled rather than inventing a deadline', () => {
    expect(describeProof(status({ nextProofDue: null }), NOW).nextProofDue).toBe('not scheduled yet')
  })

  it('says how far overdue a late proof is', () => {
    const late = status({ nextProofDue: new Date('2026-09-11T09:30:00Z'), isProofOverdue: true })

    expect(describeProof(late, NOW).nextProofDue).toBe('overdue by about 2 h')
  })

  it.each([
    ['2026-09-11T11:59:30Z', 'less than a minute ago'],
    ['2026-09-11T11:59:00Z', '1 min ago'],
    ['2026-09-11T11:01:00Z', '59 min ago'],
    ['2026-09-11T11:00:00Z', 'about 1 h ago'],
    ['2026-09-09T12:00:00Z', '2 days ago'],
  ])('reads a last proof at %s as "%s"', (proven, expected) => {
    expect(describeProof(status({ lastProven: new Date(proven) }), NOW).lastProven).toBe(expected)
  })

  it('does not show a negative gap when a due time has just passed but is not yet overdue', () => {
    const due = status({ nextProofDue: new Date('2026-09-11T11:59:00Z'), isProofOverdue: false })

    expect(describeProof(due, NOW).nextProofDue).toBe('in less than a minute')
  })
})
