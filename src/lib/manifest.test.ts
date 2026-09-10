import { describe, expect, it } from 'vitest'
import {
  canonicalize,
  MANIFEST_SCHEMA_VERSION,
  type Manifest,
  ManifestError,
  type ManifestRecord,
  manifestBytes,
  parseManifest,
  recordByCid,
} from './manifest.js'

/** `digest` is one hex character repeated, so each record has a distinct valid sha256. */
function demoRecord(
  slug: string,
  filename: string,
  mimeType: string,
  size: number,
  type: string,
  digest: string
): ManifestRecord {
  return {
    cid: `bafkrei${slug}bytes`,
    filename,
    mimeType,
    pieceCid: `bafkzcibca${slug}`,
    sha256: digest.repeat(64),
    size,
    type,
  }
}

function demoManifest(): Manifest {
  return {
    assetId: 'BAL-PROP-001',
    records: [
      demoRecord('deed', 'deed.pdf', 'application/pdf', 188416, 'deed', 'a'),
      demoRecord('parcel', 'parcel.json', 'application/json', 3481, 'parcel_record', 'b'),
    ],
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    storage: { dataSetId: 1842, network: 'filecoin-calibration', providerId: 12 },
    version: 1,
  }
}

describe('canonicalize', () => {
  it('sorts keys at every depth', () => {
    const text = canonicalize(demoManifest())
    const topLevel = text.match(/^ {2}"(\w+)"/gm)?.map((line) => line.trim())

    expect(topLevel).toEqual(['"assetId"', '"records"', '"schemaVersion"', '"storage"', '"version"'])
    expect(text).toContain('"dataSetId": 1842')
    expect(text.indexOf('"dataSetId"')).toBeLessThan(text.indexOf('"network"'))
    expect(text.indexOf('"cid"')).toBeLessThan(text.indexOf('"filename"'))
  })

  it('does not depend on the key order of the input object', () => {
    const manifest = demoManifest()
    const shuffled = JSON.parse(
      JSON.stringify({
        version: manifest.version,
        storage: { providerId: 12, network: 'filecoin-calibration', dataSetId: 1842 },
        schemaVersion: manifest.schemaVersion,
        records: manifest.records.map((record) => ({
          type: record.type,
          size: record.size,
          sha256: record.sha256,
          pieceCid: record.pieceCid,
          mimeType: record.mimeType,
          filename: record.filename,
          cid: record.cid,
        })),
        assetId: manifest.assetId,
      })
    ) as Manifest

    expect(canonicalize(shuffled)).toBe(canonicalize(manifest))
  })

  it('keeps the issuer record order, which is the display order', () => {
    const text = canonicalize(demoManifest())
    expect(text.indexOf('deed.pdf')).toBeLessThan(text.indexOf('parcel.json'))
  })

  it('ends with exactly one newline', () => {
    const text = canonicalize(demoManifest())
    expect(text.endsWith('}\n')).toBe(true)
    expect(text.endsWith('}\n\n')).toBe(false)
  })

  it('serializes a manifest with no records', () => {
    const empty = { ...demoManifest(), records: [] }

    expect(canonicalize(empty)).toContain('"records": []')
  })

  it('round-trips through parse without changing the bytes', () => {
    const first = manifestBytes(demoManifest())
    const second = manifestBytes(parseManifest(first))

    expect(second).toEqual(first)
  })
})

describe('parseManifest', () => {
  it('rejects text that is not JSON', () => {
    expect(() => parseManifest('not json')).toThrow(ManifestError)
  })

  it('rejects a schema version this build does not read', () => {
    const text = canonicalize({ ...demoManifest(), schemaVersion: 99 })
    expect(() => parseManifest(text)).toThrow(/unsupported schemaVersion 99/)
  })

  it.each([
    [
      'a record field of the wrong type',
      (m: Manifest) => void (m.records[1]!.size = '3481' as never),
      /records\[1\]\.size must be a number, got string/,
    ],
    [
      'a missing storage field, reported as missing rather than as the wrong type',
      (m: Manifest) => void delete (m.storage as Partial<Manifest['storage']>).dataSetId,
      /storage\.dataSetId must be a number, got nothing/,
    ],
    [
      'records that are not an array',
      (m: Manifest) => void (m.records = { deed: {} } as never),
      /records must be an array/,
    ],
    ['a missing assetId', (m: Manifest) => void delete (m as Partial<Manifest>).assetId, /assetId must be a string/],
    [
      'a sha256 that is not 64 hex characters',
      (m: Manifest) => void (m.records[0]!.sha256 = 'abc123'),
      /records\[0\]\.sha256 must be 64 lowercase hex characters/,
    ],
    [
      'a sha256 in uppercase, which would not compare equal to a computed digest',
      (m: Manifest) => void (m.records[0]!.sha256 = 'A'.repeat(64)),
      /records\[0\]\.sha256 must be 64 lowercase hex characters/,
    ],
    [
      'a negative size',
      (m: Manifest) => void (m.records[0]!.size = -1),
      /records\[0\]\.size must be a whole number of bytes, got -1/,
    ],
    [
      'a fractional size',
      (m: Manifest) => void (m.records[0]!.size = 12.5),
      /records\[0\]\.size must be a whole number of bytes, got 12\.5/,
    ],
    ['an empty cid', (m: Manifest) => void (m.records[0]!.cid = ''), /records\[0\]\.cid must not be empty/],
    [
      'an empty pieceCid',
      (m: Manifest) => void (m.records[0]!.pieceCid = ''),
      /records\[0\]\.pieceCid must not be empty/,
    ],
    [
      'the same cid listed twice, which would make recordByCid depend on order',
      (m: Manifest) => void (m.records[1]!.cid = m.records[0]!.cid),
      /lists bafkreideedbytes more than once, as parcel\.json/,
    ],
  ])('rejects %s', (_what, breakIt, message) => {
    const broken = JSON.parse(canonicalize(demoManifest())) as Manifest
    breakIt(broken)

    expect(() => parseManifest(JSON.stringify(broken))).toThrow(message)
  })
})

describe('parseManifest on the edges', () => {
  it('accepts a manifest with no records', () => {
    const text = canonicalize({ ...demoManifest(), records: [] })

    expect(parseManifest(text).records).toEqual([])
  })

  it('accepts a record of zero bytes', () => {
    const manifest = demoManifest()
    manifest.records[0]!.size = 0

    expect(parseManifest(canonicalize(manifest)).records[0]?.size).toBe(0)
  })

  it('keeps version 1 distinct from the schema version', () => {
    const parsed = parseManifest(canonicalize({ ...demoManifest(), version: 7 }))

    expect(parsed.version).toBe(7)
    expect(parsed.schemaVersion).toBe(MANIFEST_SCHEMA_VERSION)
  })
})

describe('recordByCid', () => {
  it('finds a record the manifest lists', () => {
    expect(recordByCid(demoManifest(), 'bafkreiparcelbytes')?.filename).toBe('parcel.json')
  })

  it('returns nothing for a CID the manifest does not list', () => {
    expect(recordByCid(demoManifest(), 'bafkreitampered')).toBeUndefined()
  })
})
