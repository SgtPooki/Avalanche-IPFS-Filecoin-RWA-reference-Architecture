/**
 * Seed the demo asset: two versions, both anchored, both verifiable.
 *
 * This exists because storing one record on Calibration took 128 seconds in
 * `spike-calibration.ts`. Nothing on a stage waits for that. The Verify screen
 * in the recording reads an asset that was published well beforehand, so the
 * demo depends on a storage provider having already done its work rather than
 * on one doing it in the next two minutes.
 *
 * Version 1 is the five records of the dataset. Version 2 replaces the 2025 tax
 * assessment with the 2026 one and changes nothing else, so the four unchanged
 * records keep the pieces they already have. An update uploads what changed and
 * re-anchors; it does not re-upload the asset.
 *
 * Writes `seed-output.json`, which the app reads to know what to show.
 *
 *   npm run seed
 */

import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { calibration } from '@filoz/synapse-sdk'
import { initializeSynapse } from 'filecoin-pin'
import { anchorManifest, registry, writeClient } from '../src/lib/avalanche.js'
import { computeFileCid } from '../src/lib/cid.js'
import { quietLogger, uploadRecord } from '../src/lib/filecoin.js'
import { MANIFEST_SCHEMA_VERSION, type Manifest, type ManifestRecord, manifestBytes } from '../src/lib/manifest.js'
import { ASSET, buildDataset, type DatasetFile } from './lib/dataset.js'

const privateKey = process.env.PRIVATE_KEY
if (privateKey == null || !privateKey.startsWith('0x')) {
  throw new Error('PRIVATE_KEY must be set, see .env.example')
}

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'seed-output.json')
const NETWORK = 'filecoin-calibration'

/** Which files make up each version. The tampered deed is in neither. */
const V1 = ['property.json', 'deed.pdf', 'parcel.json', 'tax-assessment-2025.pdf', 'survey.pdf']
const V2 = ['property.json', 'deed.pdf', 'parcel.json', 'tax-assessment-2026.pdf', 'survey.pdf']

const dataset = buildDataset()
const fileNamed = (name: string): DatasetFile => {
  const file = dataset.find((candidate) => candidate.name === name)
  if (file == null) throw new Error(`the dataset has no ${name}`)
  return file
}

const logger = quietLogger()
const synapse = await initializeSynapse({ privateKey: privateKey as `0x${string}`, chain: calibration }, logger)
const wallet = writeClient(privateKey as `0x${string}`)
const owner = wallet.account!.address

console.log(`asset     ${ASSET.assetId}`)
console.log(`owner     ${owner}`)
console.log(`registry  ${registry.address} on chain ${registry.chain.id}`)

/** Pieces already uploaded this run, so an unchanged record is stored once. */
const uploaded = new Map<string, ManifestRecord & { dataSetId: number; providerId: number }>()

async function store(name: string): Promise<ManifestRecord & { dataSetId: number; providerId: number }> {
  const existing = uploaded.get(name)
  if (existing != null) {
    console.log(`    ${name.padEnd(26)} already stored, reusing ${existing.pieceCid.slice(0, 20)}…`)
    return existing
  }

  const file = fileNamed(name)
  const started = Date.now()
  process.stdout.write(`    ${name.padEnd(26)} storing…`)
  const result = await uploadRecord({ synapse, bytes: file.bytes, filename: file.name, logger })
  const record = {
    cid: result.cid,
    filename: file.name,
    mimeType: file.mimeType,
    pieceCid: result.pieceCid,
    sha256: result.sha256,
    size: result.size,
    type: file.type ?? 'unknown',
    dataSetId: result.dataSetId,
    providerId: result.providerId,
  }
  uploaded.set(name, record)
  console.log(`\r    ${name.padEnd(26)} ${result.cid.slice(0, 20)}… in ${((Date.now() - started) / 1000).toFixed(0)}s`)
  return record
}

interface SeededVersion {
  version: number
  manifestCid: string
  manifestPieceCid: string
  dataSetId: number
  transactionHash: string
  blockNumber: string
  records: ManifestRecord[]
}

async function publish(label: string, names: string[]): Promise<SeededVersion> {
  console.log(`\n${label}`)
  const records: ManifestRecord[] = []
  let placement: { dataSetId: number; providerId: number } | null = null

  for (const name of names) {
    const stored = await store(name)
    placement ??= { dataSetId: stored.dataSetId, providerId: stored.providerId }
    const { dataSetId: _d, providerId: _p, ...record } = stored
    records.push(record)
  }

  const manifest: Manifest = {
    assetId: ASSET.assetId,
    records,
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    storage: { dataSetId: placement!.dataSetId, network: NETWORK, providerId: placement!.providerId },
  }

  process.stdout.write('    manifest.json              storing…')
  const manifestUpload = await uploadRecord({
    synapse,
    bytes: manifestBytes(manifest),
    filename: 'manifest.json',
    logger,
  })
  console.log(`\r    manifest.json              ${manifestUpload.cid.slice(0, 20)}…`)

  const anchored = await anchorManifest(wallet, {
    assetId: ASSET.assetId,
    manifestCid: manifestUpload.cid,
    manifestPieceCid: manifestUpload.pieceCid,
    dataSetId: manifestUpload.dataSetId,
  })
  console.log(`    anchored as version ${anchored.version}, tx ${anchored.transactionHash}`)

  return {
    version: anchored.version,
    manifestCid: manifestUpload.cid,
    manifestPieceCid: manifestUpload.pieceCid,
    dataSetId: manifestUpload.dataSetId,
    transactionHash: anchored.transactionHash,
    blockNumber: anchored.blockNumber.toString(),
    records,
  }
}

const started = Date.now()
const first = await publish('Version 1, the record set as filed', V1)
const second = await publish('Version 2, the 2026 tax assessment replaces the 2025 one', V2)

const output = {
  assetId: ASSET.assetId,
  owner,
  network: { avalanche: registry.chain.id, filecoin: NETWORK },
  registry: registry.address,
  seededAt: new Date().toISOString(),
  versions: [first, second],
  /**
   * Never uploaded and in no manifest. Recorded so the tamper screen can say
   * which CID it expects to be refused, without anyone having to store it.
   */
  tamperedDeedCid: await computeFileCid(fileNamed('deed-tampered.pdf').bytes),
}
await writeFile(OUT, `${JSON.stringify(output, null, 2)}\n`)

console.log(`\nSeeded in ${((Date.now() - started) / 60_000).toFixed(1)} min`)
console.log(`Wrote ${path.relative(process.cwd(), OUT)}`)
console.log(`Verify with: npm run verify -- ${ASSET.assetId}`)
