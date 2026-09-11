/**
 * The pure parts of the Avalanche module. Anything that talks to Fuji is
 * exercised by `scripts/spike-fuji.ts`, not here.
 */

import { describe, expect, it } from 'vitest'
import { type AnchorInput, RegistryError, registry, validateAnchor } from './avalanche.js'
import { registryAbi } from './registry-abi.js'

function anchor(overrides: Partial<AnchorInput> = {}): AnchorInput {
  return {
    assetId: 'BAL-PROP-001',
    manifestCid: 'bafkreimanifestbytes',
    manifestPieceCid: 'bafkzcibcamanifest',
    dataSetId: 1842,
    ...overrides,
  }
}

describe('validateAnchor', () => {
  it('accepts an anchor a verifier can follow', () => {
    expect(() => validateAnchor(anchor())).not.toThrow()
  })

  // The contract only rejects an empty manifestCid. Everything below would be
  // a successful Avalanche transaction that then fails verification.
  it.each([
    ['an empty assetId', { assetId: '' }, /assetId must not be empty/],
    ['an assetId of only spaces', { assetId: '   ' }, /assetId must not be empty/],
    ['an empty manifestCid', { manifestCid: '' }, /manifestCid must not be empty/],
    ['an empty manifestPieceCid', { manifestPieceCid: '' }, /manifestPieceCid must not be empty/],
    ['a zero dataSetId', { dataSetId: 0 }, /dataSetId must be a positive whole number, got 0/],
    ['a negative dataSetId', { dataSetId: -1 }, /dataSetId must be a positive whole number, got -1/],
    ['a fractional dataSetId', { dataSetId: 18.42 }, /dataSetId must be a positive whole number, got 18.42/],
  ])('refuses %s', (_what, overrides, message) => {
    expect(() => validateAnchor(anchor(overrides))).toThrow(message)
  })

  it('throws a RegistryError, so callers can tell it apart from an RPC failure', () => {
    expect(() => validateAnchor(anchor({ dataSetId: 0 }))).toThrow(RegistryError)
  })

  it('reports every problem at once rather than one per attempt', () => {
    const broken = anchor({ assetId: '', manifestPieceCid: '', dataSetId: 0 })

    expect(() => validateAnchor(broken)).toThrow(/assetId[\s\S]*manifestPieceCid[\s\S]*dataSetId/)
  })
})

describe('registry configuration', () => {
  it('points at the deployed Fuji registry', () => {
    expect(registry.address).toBe('0x7fdfdb7F166A3dEE947A5533e20B8E5Ce8c80863')
    expect(registry.chain.id).toBe(43113)
  })

  it('carries a deploy block, so a log scan has a floor', () => {
    // Scanning a public RPC from genesis times out. The value is the block the
    // registry's bytecode first appears in, found by bisecting getCode.
    expect(registry.deployBlock).toBe(58303958n)
  })
})

describe('the hand-written ABI', () => {
  it.each(['setManifest', 'registerAsset', 'currentManifest', 'history', 'versionCount'])(
    'declares %s',
    (name) => {
      expect(registryAbi.some((item) => item.type === 'function' && item.name === name)).toBe(true)
    }
  )

  it('declares the ManifestUpdated event the history scan filters on', () => {
    const event = registryAbi.find((item) => item.type === 'event' && item.name === 'ManifestUpdated')

    expect(event).toBeDefined()
    // owner is indexed so the RPC can filter on it; assetId is not, which is
    // why manifestUpdateHashes filters assetId in JavaScript.
    expect(event?.inputs.find((i) => i.name === 'owner')).toMatchObject({ indexed: true })
    expect(event?.inputs.find((i) => i.name === 'assetId')).toMatchObject({ indexed: false })
  })

  it('declares the custom errors, so a revert reads as a name and not as a selector', () => {
    const errors = registryAbi.filter((item) => item.type === 'error').map((item) => item.name)

    expect(errors).toEqual(['AssetExists', 'UnknownAsset', 'EmptyCid'])
  })
})
