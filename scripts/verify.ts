/**
 * Verify an asset from the command line, the way anyone else would.
 *
 * This is the whole claim of the template in one script: read the pointer from
 * Avalanche, fetch the manifest and every record from Filecoin, re-hash them,
 * and check the storage proofs. It trusts nothing from the issuer and holds no
 * key, because verifying costs nothing and needs no account.
 *
 *   npm run verify                       the demo asset
 *   npm run verify -- SOME-ASSET-ID      another asset under the same owner
 *   npm run verify -- SOME-ASSET-ID 0x…  another asset under another owner
 *
 * A second argument checks a local file against every version of the asset,
 * which is the tamper case:
 *
 *   npm run verify -- BAL-PROP-001 --file data/deed-tampered.pdf
 */

import { readFile } from 'node:fs/promises'
import { calibration } from '@filoz/synapse-sdk'
import { initializeSynapse } from 'filecoin-pin'
import type { Address } from 'viem'
import { checkDocument, verifyAssetRecord } from '../src/lib/asset-record.js'
import { readClient, registry } from '../src/lib/avalanche.js'
import { quietLogger, describeProof } from '../src/lib/filecoin.js'
import { ASSET } from './lib/dataset.js'

const DEMO_OWNER = '0x44f08D1beFe61255b3C3A349C392C560FA333759' as Address

const args = process.argv.slice(2)
const fileFlag = args.indexOf('--file')
const filePath = fileFlag === -1 ? null : args[fileFlag + 1]
const positional = (fileFlag === -1 ? args : args.slice(0, fileFlag)).filter((a) => !a.startsWith('-'))

const assetId = positional[0] ?? ASSET.assetId
const owner = (positional[1] ?? DEMO_OWNER) as Address

// Read-only on both chains. No private key is read and none is needed.
const client = readClient()
const synapse = await initializeSynapse({ walletAddress: owner, readOnly: true, chain: calibration }, quietLogger())

console.log(`asset     ${assetId}`)
console.log(`owner     ${owner}`)
console.log(`registry  ${registry.address} on chain ${registry.chain.id}\n`)

if (filePath != null) {
  const bytes = new Uint8Array(await readFile(filePath))
  const { cid, matched } = await checkDocument(client, synapse, owner, assetId, bytes)
  console.log(`${filePath}`)
  console.log(`  fingerprint  ${cid}`)
  if (matched == null) {
    console.log('  verdict      NOT A DOCUMENT OF RECORD')
    console.log(`               this fingerprint appears in no version of ${assetId}`)
    process.exitCode = 1
  } else {
    console.log(`  verdict      on record as ${matched.record.filename}, version ${matched.version}`)
  }
  process.exit(process.exitCode ?? 0)
}

const started = Date.now()
const verdict = await verifyAssetRecord(client, synapse, owner, assetId)
const took = ((Date.now() - started) / 1000).toFixed(1)

if (!verdict.anchored) {
  console.log(`NOT ANCHORED. ${verdict.problems.join(' ')}`)
  process.exit(1)
}

console.log(`version ${verdict.anchor?.version} anchored ${verdict.anchor?.publishedAt.toISOString()}`)
console.log(`manifest ${verdict.anchor?.manifestCid}\n`)

const now = new Date()
const tick = (ok: boolean): string => (ok ? 'yes' : 'NO ')
console.log('record                     content  fetched  proven   last proof')
for (const record of verdict.records) {
  const proof = record.proof == null ? 'unknown' : describeProof(record.proof, now).lastProven
  console.log(
    `  ${record.filename.padEnd(24)} ${tick(record.contentMatches)}      ` +
      `${tick(record.retrievable)}      ${tick(record.storageProven)}      ${proof}`
  )
}

if (verdict.problems.length > 0) {
  console.log('\nproblems')
  for (const problem of verdict.problems) console.log(`  ${problem}`)
}

console.log(`\n${verdict.verified ? 'VERIFIED' : 'FAILED'} in ${took}s`)
if (!verdict.verified) process.exitCode = 1
