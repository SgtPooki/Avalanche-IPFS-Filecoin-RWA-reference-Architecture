/**
 * The manifest is the one document Avalanche points at.
 *
 * It lists every record in the asset by content CID and Filecoin piece CID,
 * and it is stored on Filecoin as a record like any other. A verifier that
 * reads the manifest CID off the registry needs nothing else.
 *
 * The serialization is canonical: object keys sorted at every depth, two-space
 * indent, one trailing newline, and no timestamps or other incidental fields.
 * Same inputs, same bytes, same CID, on any machine. The bytes below are also
 * exactly what the app shows on the anchor screen, so the JSON on screen is
 * the JSON that was hashed.
 *
 * There is no version number in here. `AssetRecordRegistry` already appends a
 * version on every `setManifest`, and a number inside the manifest could
 * disagree with it: two issuers anchoring at once would each write a manifest
 * claiming v1, and the second would land as v2. The chain assigns versions and
 * the manifest describes one set of records. `schemaVersion` is a different
 * thing, and it is the shape of this document.
 */

export const MANIFEST_SCHEMA_VERSION = 1

/** Record kinds the demo dataset uses. Forks are free to add their own. */
export const RECORD_TYPES = ['property_metadata', 'deed', 'parcel_record', 'tax_assessment', 'survey'] as const

export type RecordType = (typeof RECORD_TYPES)[number]

export interface ManifestRecord {
  /** UnixFS CID of the file bytes, as computed by `computeFileCid`. */
  cid: string
  /**
   * The Filecoin data set proving this piece.
   *
   * Per record, not per asset. Nothing guarantees a batch of uploads lands in
   * one data set: a provider can seal one partway through and put the rest
   * somewhere else. A manifest that named a single data set for everything
   * would then be wrong about the later records, and they would fail
   * verification with "this data set does not hold piece X" while being
   * perfectly intact.
   */
  dataSetId: number
  filename: string
  mimeType: string
  /** Filecoin piece CID returned by the upload. */
  pieceCid: string
  /** Lowercase hex SHA-256 of the file bytes. */
  sha256: string
  size: number
  type: string
}

export interface ManifestStorage {
  dataSetId: number
  /** Chain the data set lives on, for example `filecoin-calibration`. */
  network: string
  providerId: number
}

export interface Manifest {
  assetId: string
  /** Issuer-chosen order. It is the display order, and it is preserved. */
  records: ManifestRecord[]
  schemaVersion: number
  storage: ManifestStorage
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

function sortKeysDeep(value: Json): Json {
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  if (value === null || typeof value !== 'object') return value

  const sorted: { [key: string]: Json } = {}
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortKeysDeep(value[key] as Json)
  }
  return sorted
}

/** Serialize a manifest to its canonical text. */
export function canonicalize(manifest: Manifest): string {
  return `${JSON.stringify(sortKeysDeep(manifest as unknown as Json), null, 2)}\n`
}

/** Serialize a manifest to the exact bytes that get uploaded and hashed. */
export function manifestBytes(manifest: Manifest): Uint8Array {
  return new TextEncoder().encode(canonicalize(manifest))
}

export class ManifestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ManifestError'
  }
}

function field<T>(source: Record<string, unknown>, key: string, kind: 'string' | 'number', where: string): T {
  const value = source[key]
  if (typeof value !== kind) {
    throw new ManifestError(`${where}.${key} must be a ${kind}, got ${value === undefined ? 'nothing' : typeof value}`)
  }
  return value as T
}

function asObject(value: unknown, where: string, allowedKeys?: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ManifestError(`${where} must be an object`)
  }
  const object = value as Record<string, unknown>

  // Unknown keys are refused rather than ignored. A manifest is hashed and
  // anchored; anything inside it is part of what the issuer signed for, and
  // silently dropping a field means the document on Filecoin and the document
  // this code believes in are not the same document.
  if (allowedKeys != null) {
    const unknown = Object.keys(object).filter((key) => !allowedKeys.includes(key))
    if (unknown.length > 0) {
      throw new ManifestError(`${where} has unknown field${unknown.length > 1 ? 's' : ''} ${unknown.join(', ')}`)
    }
  }
  return object
}

const RECORD_KEYS = ['cid', 'dataSetId', 'filename', 'mimeType', 'pieceCid', 'sha256', 'size', 'type'] as const
const STORAGE_KEYS = ['dataSetId', 'network', 'providerId'] as const
const MANIFEST_KEYS = ['assetId', 'records', 'schemaVersion', 'storage'] as const

const SHA256_HEX = /^[0-9a-f]{64}$/

function parseRecord(value: unknown, index: number): ManifestRecord {
  const where = `records[${index}]`
  const source = asObject(value, where, RECORD_KEYS)
  const record: ManifestRecord = {
    cid: field(source, 'cid', 'string', where),
    dataSetId: field(source, 'dataSetId', 'number', where),
    filename: field(source, 'filename', 'string', where),
    mimeType: field(source, 'mimeType', 'string', where),
    pieceCid: field(source, 'pieceCid', 'string', where),
    sha256: field(source, 'sha256', 'string', where),
    size: field(source, 'size', 'number', where),
    type: field(source, 'type', 'string', where),
  }

  // A record the verifier cannot check is worse than one it refuses, because
  // the refusal is visible and the unusable hash reads as a pass.
  if (!SHA256_HEX.test(record.sha256)) {
    throw new ManifestError(`${where}.sha256 must be 64 lowercase hex characters, got "${record.sha256}"`)
  }
  if (!Number.isInteger(record.size) || record.size < 0) {
    throw new ManifestError(`${where}.size must be a whole number of bytes, got ${record.size}`)
  }
  if (!Number.isInteger(record.dataSetId) || record.dataSetId <= 0) {
    throw new ManifestError(`${where}.dataSetId must be a positive whole number, got ${record.dataSetId}`)
  }
  if (record.cid === '') throw new ManifestError(`${where}.cid must not be empty`)
  if (record.pieceCid === '') throw new ManifestError(`${where}.pieceCid must not be empty`)

  return record
}

function parseStorage(value: unknown): ManifestStorage {
  const source = asObject(value, 'storage', STORAGE_KEYS)
  return {
    dataSetId: field(source, 'dataSetId', 'number', 'storage'),
    network: field(source, 'network', 'string', 'storage'),
    providerId: field(source, 'providerId', 'number', 'storage'),
  }
}

/**
 * Parse manifest bytes or text that came off Filecoin.
 *
 * Rejects anything it cannot read rather than filling in defaults. A manifest
 * the verifier half-understands is worse than one it refuses.
 */
export function parseManifest(source: string | Uint8Array): Manifest {
  const text = typeof source === 'string' ? source : new TextDecoder().decode(source)

  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (cause) {
    throw new ManifestError(`manifest is not JSON: ${(cause as Error).message}`)
  }

  const root = asObject(value, 'manifest', MANIFEST_KEYS)
  const schemaVersion = field<number>(root, 'schemaVersion', 'number', 'manifest')
  if (schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    throw new ManifestError(`unsupported schemaVersion ${schemaVersion}, this build reads ${MANIFEST_SCHEMA_VERSION}`)
  }

  const records = root.records
  if (!Array.isArray(records)) throw new ManifestError('manifest.records must be an array')

  const parsed = records.map(parseRecord)

  // `recordByCid` returns the first match, so two records under one CID would
  // make the verifier's answer depend on order. Refuse instead.
  const seen = new Set<string>()
  for (const record of parsed) {
    if (seen.has(record.cid)) {
      throw new ManifestError(`manifest lists ${record.cid} more than once, as ${record.filename}`)
    }
    seen.add(record.cid)
  }

  return {
    assetId: field(root, 'assetId', 'string', 'manifest'),
    records: parsed,
    schemaVersion,
    storage: parseStorage(root.storage),
  }
}

/** Look a record up by the CID of its bytes. Returns undefined for a CID the manifest does not list. */
export function recordByCid(manifest: Manifest, cid: string): ManifestRecord | undefined {
  return manifest.records.find((record) => record.cid === cid)
}
