/**
 * Verdict semantics, with both chains faked at the module boundary.
 *
 * The property under test throughout: a network that did not answer is not
 * evidence. "Not on record" and "not anchored" are only ever said once every
 * source that could contradict them has actually been read.
 */

import type { Synapse } from '@filoz/synapse-sdk'
import type { PublicClient } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findDocumentByCid, readAnchoredManifest, verifyAssetRecord } from './asset-record.js'
import type { ManifestVersion } from './avalanche.js'
import { computeFileCid } from './cid.js'
import type { StorageStatus } from './filecoin.js'
import { type Manifest, manifestBytes } from './manifest.js'

vi.mock('./avalanche.js', () => ({
  currentManifest: vi.fn(),
  manifestHistory: vi.fn(),
  anchorManifest: vi.fn(),
}))
vi.mock('./filecoin.js', () => ({
  fetchRecord: vi.fn(),
  storageContext: vi.fn(),
  pieceStatusIn: vi.fn(),
  getStorageStatus: vi.fn(),
  uploadRecord: vi.fn(),
}))

const avalanche = vi.mocked(await import('./avalanche.js'))
const filecoin = vi.mocked(await import('./filecoin.js'))

const OWNER = '0x44f08D1beFe61255b3C3A349C392C560FA333759'
const ASSET = 'FAIRVIEW-0031'
const DEED_CID = 'bafkreidh5qsi5z6uo2thzvynr27ioajoviafqiveunrielhugyj65l6rzu'
const OTHER_CID = 'bafkreiausintabvl4n4hvgv2jdmazvy35bg26gku2ufu2bosxhrd7dzxqi'
const client = {} as PublicClient
const synapse = {} as Synapse

function manifest(records: Manifest['records'], assetId = ASSET): Manifest {
  return { assetId, records, schemaVersion: 1, storage: { dataSetId: 54, network: 'filecoin-calibration', providerId: 12 } }
}

const deed = {
  cid: DEED_CID,
  dataSetId: 54,
  filename: 'deed.pdf',
  mimeType: 'application/pdf',
  pieceCid: 'bafkzcibd74eao2wcvlngjfpimalqx3sjjpp6qjusu6nywc3jsfwiszmowxhaqwbr',
  sha256: '67ec248ee7d476a67cd70d8ebe87012eaa005822a4a362822cf43613eeafd1cd',
  size: 2816,
  type: 'deed',
}

/** A version whose pointer really is the CID of the given manifest bytes. */
async function anchored(version: number, bytes: Uint8Array): Promise<ManifestVersion> {
  return {
    version,
    manifestCid: await computeFileCid(bytes),
    manifestPieceCid: `piece-of-version-${version}`,
    dataSetId: 54,
    publishedAt: new Date('2026-09-11T16:29:06Z'),
  }
}

/** fetchRecord keyed by piece CID; a missing key rejects like a dead provider. */
function providerHolding(pieces: Record<string, Uint8Array>): void {
  filecoin.fetchRecord.mockImplementation(async (_synapse, pieceCid) => {
    const bytes = pieces[pieceCid]
    if (bytes == null) throw new Error(`no provider answered for ${pieceCid}`)
    return bytes
  })
}

const proven: StorageStatus = {
  lastProven: new Date('2026-09-11T15:00:00Z'),
  nextProofDue: new Date('2026-09-12T15:00:00Z'),
  isProofOverdue: false,
  retrievalUrl: null,
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('findDocumentByCid', () => {
  it('matches in an older version even when the newest manifest cannot be read, and names the unreadable one', async () => {
    const v1 = manifestBytes(manifest([deed]))
    avalanche.manifestHistory.mockResolvedValue([await anchored(1, v1), await anchored(2, new Uint8Array([2]))])
    providerHolding({ 'piece-of-version-1': v1 })

    const lookup = await findDocumentByCid(client, synapse, OWNER, ASSET, DEED_CID)

    expect(lookup).toEqual({ outcome: 'matched', version: 1, record: deed, unreadable: [2] })
  })

  it('says unmatched only after every version was read', async () => {
    const v1 = manifestBytes(manifest([deed]))
    const v2 = manifestBytes(manifest([{ ...deed, cid: OTHER_CID }]))
    avalanche.manifestHistory.mockResolvedValue([await anchored(1, v1), await anchored(2, v2)])
    providerHolding({ 'piece-of-version-1': v1, 'piece-of-version-2': v2 })

    const lookup = await findDocumentByCid(client, synapse, OWNER, ASSET, 'bafkreicidnobodypublished')

    expect(lookup).toEqual({ outcome: 'unmatched', versions: 2 })
  })

  it('reports an unreadable version as incomplete rather than as a miss', async () => {
    const v2 = manifestBytes(manifest([{ ...deed, cid: OTHER_CID }]))
    avalanche.manifestHistory.mockResolvedValue([await anchored(1, new Uint8Array([1])), await anchored(2, v2)])
    providerHolding({ 'piece-of-version-2': v2 })

    const lookup = await findDocumentByCid(client, synapse, OWNER, ASSET, DEED_CID)

    expect(lookup).toEqual({ outcome: 'incomplete', versions: 2, unreadable: [1] })
  })

  it('throws when the registry itself cannot be read, because there is no lookup to report', async () => {
    avalanche.manifestHistory.mockRejectedValue(new Error('HTTP request failed'))

    await expect(findDocumentByCid(client, synapse, OWNER, ASSET, DEED_CID)).rejects.toThrow('HTTP request failed')
  })
})

describe('readAnchoredManifest', () => {
  it('rejects bytes that do not hash to the anchored CID', async () => {
    const version = await anchored(1, manifestBytes(manifest([deed])))
    providerHolding({ 'piece-of-version-1': manifestBytes(manifest([{ ...deed, size: 1 }])) })

    await expect(readAnchoredManifest(synapse, version, ASSET)).rejects.toThrow('but Avalanche points at')
  })

  it('rejects a manifest anchored under one asset that names another', async () => {
    const bytes = manifestBytes(manifest([deed], 'SOMEBODY-ELSE'))
    providerHolding({ 'piece-of-version-1': bytes })

    await expect(readAnchoredManifest(synapse, await anchored(1, bytes), ASSET)).rejects.toThrow('says it belongs to SOMEBODY-ELSE')
  })

  it('rejects a manifest that lists no records', async () => {
    const bytes = manifestBytes(manifest([]))
    providerHolding({ 'piece-of-version-1': bytes })

    await expect(readAnchoredManifest(synapse, await anchored(1, bytes), ASSET)).rejects.toThrow('lists no records')
  })
})

describe('verifyAssetRecord', () => {
  it('reports an unreachable registry as unread, not as unanchored', async () => {
    avalanche.currentManifest.mockRejectedValue(new Error('HTTP request failed'))

    const verdict = await verifyAssetRecord(client, synapse, OWNER, ASSET)

    expect(verdict).toMatchObject({ verified: false, avalancheRead: false, anchored: false })
    expect(verdict.problems).toEqual(['Avalanche could not be read: HTTP request failed'])
  })

  it('leaves the content check unknown for a record that could not be fetched', async () => {
    const bytes = manifestBytes(manifest([deed]))
    avalanche.currentManifest.mockResolvedValue(await anchored(1, bytes))
    providerHolding({ 'piece-of-version-1': bytes })
    filecoin.storageContext.mockResolvedValue({} as never)
    filecoin.pieceStatusIn.mockResolvedValue(proven)

    const verdict = await verifyAssetRecord(client, synapse, OWNER, ASSET)

    expect(verdict.records[0]).toMatchObject({ filename: 'deed.pdf', contentMatches: null, retrievable: false, storageProven: true })
    expect(verdict.verified).toBe(false)
  })

  it('fails the asset when the manifest piece itself has no current proof', async () => {
    const deedBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46])
    const record = { ...deed, cid: await computeFileCid(deedBytes) }
    const bytes = manifestBytes(manifest([record]))
    avalanche.currentManifest.mockResolvedValue(await anchored(1, bytes))
    providerHolding({ 'piece-of-version-1': bytes, [record.pieceCid]: deedBytes })
    filecoin.storageContext.mockResolvedValue({} as never)
    filecoin.pieceStatusIn.mockImplementation(async (_context, pieceCid) =>
      pieceCid === 'piece-of-version-1' ? { ...proven, lastProven: null } : proven
    )

    const verdict = await verifyAssetRecord(client, synapse, OWNER, ASSET)

    expect(verdict.records[0]).toMatchObject({ contentMatches: true, retrievable: true, storageProven: true })
    expect(verdict).toMatchObject({ verified: false, manifestStorageProven: false })
    expect(verdict.problems).toEqual(['manifest: the data set has not been proven yet'])
  })
})
