/**
 * The four functions a fork actually calls.
 *
 * Everything below composes the lower modules: `cid` for fingerprints,
 * `manifest` for the canonical document, `filecoin` for storage, `avalanche`
 * for the pointer. Those are worth reading, but nobody adapting this template
 * should have to wire them together by hand.
 *
 *   storeAssetRecord    publish a record set and anchor it
 *   getAssetRecord      read the current manifest for an asset
 *   verifyAssetRecord   check an asset against both chains
 *   getStorageStatus    proof state for one piece (re-exported from ./filecoin)
 *
 * To move this to another domain, change the record types and the dataset.
 * Nothing here knows what a deed is.
 */

import type { Synapse } from '@filoz/synapse-sdk'
import type { Address, Hex, PublicClient, WalletClient } from 'viem'
import { anchorManifest, currentManifest, type ManifestVersion, manifestHistory } from './avalanche.js'
import { computeFileCid } from './cid.js'
import {
  fetchRecord,
  pieceStatusIn,
  type StorageStatus,
  storageContext,
  uploadRecord,
} from './filecoin.js'
import {
  type Manifest,
  MANIFEST_SCHEMA_VERSION,
  type ManifestRecord,
  manifestBytes,
  parseManifest,
} from './manifest.js'

export { getStorageStatus } from './filecoin.js'
export type { StorageStatus } from './filecoin.js'

/** One document on its way in. */
export interface RecordInput {
  filename: string
  /** Manifest record type, for example `deed` or `tax_assessment`. */
  type: string
  mimeType: string
  bytes: Uint8Array
}

export interface StoreAssetRecordOptions {
  synapse: Synapse
  wallet: WalletClient
  assetId: string
  records: RecordInput[]
  network?: string
  /** Called as each step completes, for a progress line. */
  onProgress?: (message: string) => void
}

export interface StoreAssetRecordResult {
  manifest: Manifest
  manifestCid: string
  manifestPieceCid: string
  dataSetId: number
  version: number
  transactionHash: Hex
}

/**
 * Publish a record set and anchor it on Avalanche.
 *
 * Records go up first, each as its own piece so each has its own CID and proof
 * state. The manifest is built from what came back and uploaded last, because
 * it has to name the piece CIDs. Only then is anything written to Avalanche: a
 * pointer to a manifest that does not exist yet would be worse than no pointer.
 */
export async function storeAssetRecord(options: StoreAssetRecordOptions): Promise<StoreAssetRecordResult> {
  const { synapse, wallet, assetId, records, onProgress } = options
  const note = (message: string): void => onProgress?.(message)

  if (records.length === 0) throw new Error('storeAssetRecord needs at least one record')

  const stored: ManifestRecord[] = []
  let placement: { dataSetId: number; providerId: number } | null = null

  for (const [index, record] of records.entries()) {
    note(`storing ${record.filename} (${index + 1} of ${records.length})`)
    const result = await uploadRecord({ synapse, bytes: record.bytes, filename: record.filename })
    // Where the records actually landed, taken from the first upload rather
    // than passed in, so the manifest cannot name a data set nothing is in.
    placement ??= { dataSetId: result.dataSetId, providerId: result.providerId }
    stored.push({
      cid: result.cid,
      filename: record.filename,
      mimeType: record.mimeType,
      pieceCid: result.pieceCid,
      sha256: result.sha256,
      size: result.size,
      type: record.type,
    })
  }

  const manifest: Manifest = {
    assetId,
    records: stored,
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    storage: {
      dataSetId: placement!.dataSetId,
      network: options.network ?? 'filecoin-calibration',
      providerId: placement!.providerId,
    },
  }

  note('storing the manifest')
  const manifestUpload = await uploadRecord({
    synapse,
    bytes: manifestBytes(manifest),
    filename: 'manifest.json',
  })

  note('anchoring on Avalanche')
  const anchored = await anchorManifest(wallet, {
    assetId,
    manifestCid: manifestUpload.cid,
    manifestPieceCid: manifestUpload.pieceCid,
    dataSetId: manifestUpload.dataSetId,
  })

  return {
    manifest,
    manifestCid: manifestUpload.cid,
    manifestPieceCid: manifestUpload.pieceCid,
    dataSetId: manifestUpload.dataSetId,
    version: anchored.version,
    transactionHash: anchored.transactionHash,
  }
}

export interface AssetRecord {
  /** What Avalanche holds. Null when nothing has been anchored. */
  anchor: ManifestVersion | null
  /** The manifest those bytes hash to. Null when there is no anchor. */
  manifest: Manifest | null
}

/**
 * Read an asset's current record set: the pointer from Avalanche, then the
 * manifest it points at from Filecoin.
 *
 * The manifest's own CID is checked against the anchored one before it is
 * parsed. A manifest that hashes differently is not the anchored manifest,
 * whatever it says inside.
 */
export async function getAssetRecord(
  client: PublicClient,
  synapse: Synapse,
  owner: Address,
  assetId: string
): Promise<AssetRecord> {
  const anchor = await currentManifest(client, owner, assetId)
  if (anchor == null) return { anchor: null, manifest: null }

  const bytes = await fetchRecord(synapse, anchor.manifestPieceCid, anchor.manifestCid)
  const recomputed = await computeFileCid(bytes)
  if (recomputed !== anchor.manifestCid) {
    throw new VerificationError(
      `the manifest fetched for ${assetId} hashes to ${recomputed}, but Avalanche points at ${anchor.manifestCid}`
    )
  }

  return { anchor, manifest: parseManifest(bytes) }
}

export class VerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VerificationError'
  }
}

/** Why one record passed or failed. Every field is a separate, checkable claim. */
export interface RecordVerdict {
  filename: string
  cid: string
  /** The bytes fetched hash to the CID the manifest lists. */
  contentMatches: boolean
  /** The record could be retrieved at all. */
  retrievable: boolean
  /** Filecoin reports the data set holding it as proven and not overdue. */
  storageProven: boolean
  proof: StorageStatus | null
  /** Present when a check failed, in words a UI can show. */
  problem?: string
}

export interface AssetVerdict {
  verified: boolean
  /** Avalanche has a pointer for this asset. */
  anchored: boolean
  anchor: ManifestVersion | null
  manifest: Manifest | null
  records: RecordVerdict[]
  problems: string[]
}

/**
 * Check an asset end to end, against both chains.
 *
 * Nothing here trusts the issuer. The pointer comes from Avalanche, the
 * manifest is checked against that pointer, every record is fetched and
 * re-hashed against the manifest, and the proof state comes from Filecoin.
 * A failure of any one of those fails the record, and each one says which.
 */
export async function verifyAssetRecord(
  client: PublicClient,
  synapse: Synapse,
  owner: Address,
  assetId: string
): Promise<AssetVerdict> {
  const problems: string[] = []

  let record: AssetRecord
  try {
    record = await getAssetRecord(client, synapse, owner, assetId)
  } catch (cause) {
    return {
      verified: false,
      anchored: true,
      anchor: null,
      manifest: null,
      records: [],
      problems: [(cause as Error).message],
    }
  }

  if (record.anchor == null || record.manifest == null) {
    return {
      verified: false,
      anchored: false,
      anchor: null,
      manifest: null,
      records: [],
      problems: [`Avalanche has no anchored manifest for ${assetId}`],
    }
  }

  // One context for the whole asset, and the records checked together. Opening
  // a context costs several seconds of chain reads and every record is in the
  // same data set, so doing it per record spent that cost once per file.
  const context = await storageContext(synapse, record.manifest.storage.dataSetId).catch(() => null)
  const records = await Promise.all(record.manifest.records.map((entry) => verifyOneRecord(synapse, entry, context)))

  for (const verdict of records) {
    if (verdict.problem != null) problems.push(`${verdict.filename}: ${verdict.problem}`)
  }

  return {
    verified: problems.length === 0,
    anchored: true,
    anchor: record.anchor,
    manifest: record.manifest,
    records,
    problems,
  }
}

async function verifyOneRecord(
  synapse: Synapse,
  entry: ManifestRecord,
  context: Awaited<ReturnType<typeof storageContext>> | null
): Promise<RecordVerdict> {
  const base = { filename: entry.filename, cid: entry.cid }

  let bytes: Uint8Array
  try {
    bytes = await fetchRecord(synapse, entry.pieceCid, entry.cid)
  } catch (cause) {
    return {
      ...base,
      contentMatches: false,
      retrievable: false,
      storageProven: false,
      proof: null,
      problem: `could not be retrieved (${(cause as Error).message})`,
    }
  }

  const recomputed = await computeFileCid(bytes)
  const contentMatches = recomputed === entry.cid

  let proof: StorageStatus | null = null
  try {
    proof = context == null ? null : await pieceStatusIn(context, entry.pieceCid)
  } catch {
    // A proof state that cannot be read is reported as unproven rather than as
    // a hard failure: the bytes may still be correct and retrievable.
    proof = null
  }
  const storageProven = proof != null && proof.lastProven != null && !proof.isProofOverdue

  const verdict: RecordVerdict = { ...base, contentMatches, retrievable: true, storageProven, proof }
  if (!contentMatches) {
    verdict.problem = `the bytes retrieved hash to ${recomputed}, but the manifest lists ${entry.cid}`
  } else if (!storageProven) {
    verdict.problem = proof == null ? 'proof state could not be read' : 'storage proof is overdue'
  }
  return verdict
}

/**
 * Check a file someone handed you against every version of an asset.
 *
 * The file is hashed locally and never uploaded. A CID that appears in no
 * version of the manifest is not a document of record, which is the honest
 * scenario: gateways will not serve tampered bytes, so the only way to hold one
 * is for someone to have given it to you.
 */
export async function checkDocument(
  client: PublicClient,
  synapse: Synapse,
  owner: Address,
  assetId: string,
  bytes: Uint8Array
): Promise<{ cid: string; matched: { version: number; record: ManifestRecord } | null }> {
  const cid = await computeFileCid(bytes)
  const versions = await manifestHistory(client, owner, assetId)

  for (const version of versions) {
    const manifestFile = await fetchRecord(synapse, version.manifestPieceCid, version.manifestCid)
    const manifest = parseManifest(manifestFile)
    const record = manifest.records.find((entry) => entry.cid === cid)
    if (record != null) return { cid, matched: { version: version.version, record } }
  }
  return { cid, matched: null }
}
