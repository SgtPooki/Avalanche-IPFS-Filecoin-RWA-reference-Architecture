/**
 * Spike: one record, all the way to Calibration and back.
 *
 * Nothing in this repository has touched the network yet, so every claim about
 * storage is still theory. This proves or breaks the whole storage half of the
 * demo in one run:
 *
 *   1. build a CAR from a real dataset file
 *   2. check the account can pay
 *   3. upload it
 *   4. read the proof state back
 *   5. download the piece, extract the file, re-hash it
 *
 * Step 5 is the one that matters. If the bytes that come back do not hash to
 * the CID that went up, the Verify screen is a lie.
 *
 *   npm run spike:calibration
 */

import { calibration } from '@filoz/synapse-sdk'
import { checkUploadReadiness, createCarFromFile, executeUpload, initializeSynapse } from 'filecoin-pin'
import { pino } from 'pino'
import { buildDataset } from './lib/dataset.js'
import { extractFileFromCar } from '../src/lib/car.js'
import { computeFileCid, sha256Hex } from '../src/lib/cid.js'

const privateKey = process.env.PRIVATE_KEY
if (privateKey == null || !privateKey.startsWith('0x')) {
  throw new Error('PRIVATE_KEY must be set, see .env.example')
}

const logger = pino({ level: process.env.LOG_LEVEL ?? 'warn' })
const step = (n: number, what: string): void => console.log(`\n[${n}/5] ${what}`)

// The deed is the record the tamper demo turns on, so it is the one to prove.
const deed = buildDataset().find((file) => file.name === 'deed.pdf')
if (deed == null) throw new Error('the dataset has no deed.pdf')

step(1, 'Build the CAR')
const file = new File([deed.bytes as unknown as BlobPart], deed.name)
const car = await createCarFromFile(file)
const expectedCid = await computeFileCid(deed.bytes)
const expectedSha = await sha256Hex(deed.bytes)
console.log(`    ${deed.name}  ${deed.bytes.length} bytes`)
console.log(`    file CID    ${expectedCid}`)
console.log(`    CAR root    ${car.rootCid.toString()}  ${car.rootCid.toString() === expectedCid ? 'match' : 'MISMATCH'}`)
console.log(`    CAR size    ${car.carBytes.length} bytes`)

step(2, 'Connect and check the account can pay')
const synapse = await initializeSynapse({ privateKey: privateKey as `0x${string}`, chain: calibration }, logger)
const readiness = await checkUploadReadiness({ synapse, fileSize: car.carBytes.length })
console.log(`    status      ${readiness.status}`)
console.log(`    FIL         ${readiness.filStatus.balance}`)
console.log(`    USDFC       ${readiness.walletUsdfcBalance}`)
if (readiness.status !== 'ready') {
  console.log(`    blocked     ${readiness.validation.errorMessage ?? 'no message'}`)
  for (const suggestion of readiness.suggestions) console.log(`      - ${suggestion}`)
  throw new Error('the account cannot pay for this upload')
}

step(3, 'Upload')
const started = Date.now()
const upload = await executeUpload(synapse, car.carBytes, car.rootCid, {
  logger,
  pieceMetadata: { name: deed.name },
  onProgress: (event) => console.log(`    ${event.type}`),
})
console.log(`    piece CID   ${upload.pieceCid}`)
console.log(`    complete    ${upload.complete}  in ${((Date.now() - started) / 1000).toFixed(1)}s`)
console.log(`    IPNI        ${upload.ipniValidated}`)
for (const copy of upload.copies) {
  console.log(`    copy        ${copy.role} provider ${copy.providerId} data set ${copy.dataSetId} piece ${copy.pieceId}`)
}
for (const failure of upload.failedAttempts) {
  console.log(`    failed      provider ${failure.providerId} ${failure.error}`)
}

step(4, 'Read the proof state')
const [primary] = upload.copies
if (primary == null) throw new Error('the upload reported no copies')
const [context] = await synapse.storage.createContexts({ dataSetIds: [primary.dataSetId] })
if (context == null) throw new Error(`could not open a context on data set ${primary.dataSetId}`)
const status = await context.pieceStatus({ pieceCid: upload.pieceCid })
console.log(`    last proven ${status?.dataSetLastProven?.toISOString() ?? 'never, the data set is new'}`)
console.log(`    next due    ${status?.dataSetNextProofDue?.toISOString() ?? 'not scheduled yet'}`)
console.log(`    overdue     ${status?.isProofOverdue ?? 'unknown'}`)
console.log(`    retrieval   ${status?.retrievalUrl ?? 'none'}`)

step(5, 'Download, extract, re-hash')
const downloaded = await synapse.storage.download({ pieceCid: upload.pieceCid })
console.log(`    downloaded  ${downloaded.length} bytes`)
const extracted = await extractFileFromCar(downloaded, expectedCid)
const actualCid = await computeFileCid(extracted)
const actualSha = await sha256Hex(extracted)
console.log(`    bytes       ${extracted.length}  ${extracted.length === deed.bytes.length ? 'match' : 'MISMATCH'}`)
console.log(`    CID         ${actualCid}  ${actualCid === expectedCid ? 'match' : 'MISMATCH'}`)
console.log(`    sha256      ${actualSha.slice(0, 16)}…  ${actualSha === expectedSha ? 'match' : 'MISMATCH'}`)

const roundTripped = actualCid === expectedCid && actualSha === expectedSha
console.log(`\n${roundTripped ? 'Round trip holds.' : 'ROUND TRIP BROKEN.'}`)
if (!roundTripped) process.exitCode = 1
