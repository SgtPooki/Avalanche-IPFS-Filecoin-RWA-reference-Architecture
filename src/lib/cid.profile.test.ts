/**
 * `cid.ts` repeats filecoin-pin's UnixFS profile constant because the browser
 * entry does not export it. This holds the copy to the original.
 *
 * Node only, and awkwardly so. `filecoin-pin/core/unixfs` resolves to
 * `browser.js` under the browser condition, and that file re-exports the CAR
 * builders without `importer-options.js`. This project's tsconfig sets
 * `customConditions: ["browser"]`, so TypeScript resolves the browser types
 * even here and does not believe these exports exist. Hence the dynamic import
 * and the cast: the runtime resolution is Node's, where they do. That
 * asymmetry is the whole reason the constant is repeated in `cid.ts`.
 */

import { describe, expect, it } from 'vitest'
import { importerOptions, UNIXFS_PROFILE } from './cid.js'

const upstream = (await import('filecoin-pin/core/unixfs')) as unknown as {
  UNIXFS_PROFILE?: string
  importerOptions?: Record<string, unknown>
}

describe('the repeated UnixFS profile', () => {
  it('is exported by the filecoin-pin entry this test resolves', () => {
    // Guards the cast above: without this, a rename upstream would leave both
    // sides undefined and the equality checks below would pass on nothing.
    expect(upstream.UNIXFS_PROFILE).toBeTypeOf('string')
    expect(upstream.importerOptions).toBeTypeOf('object')
  })

  it('is the profile filecoin-pin uploads under', () => {
    expect(UNIXFS_PROFILE).toBe(upstream.UNIXFS_PROFILE)
  })

  it('is the whole of the importer options filecoin-pin passes', () => {
    expect(importerOptions).toEqual(upstream.importerOptions)
  })

  it('is the IPIP-499 profile by name, so a silent rename upstream is visible here', () => {
    expect(UNIXFS_PROFILE).toBe('unixfs-v1-2025')
  })
})
