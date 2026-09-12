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
 *   npm run verify -- FAIRVIEW-0031 --file data/deed-tampered.pdf
 *
 * Exit status: 0 verified or on record, 1 failed or not on record, 2 no
 * verdict because a network could not be read. A script must never take 2 for
 * either of the others.
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

/**
 * Exit once the last line has flushed.
 *
 * Retrieval leaves sockets behind: measured right after a verdict, eight
 * pending connects and twelve TCP sockets were still open, and one run sat
 * for ten minutes after printing VERIFIED. Setting exitCode is not enough
 * while those are alive. On macOS a piped stdout is asynchronous, so the exit
 * waits for the write queue rather than cutting the verdict off.
 */
function finish(code: number): Promise<never> {
  return new Promise(() => process.stdout.write('', () => process.exit(code)))
}

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
  const { cid, lookup } = await checkDocument(client, synapse, owner, assetId, bytes)
  console.log(`${filePath}`)
  console.log(`  fingerprint  ${cid}`)
  if (lookup.outcome === 'matched') {
    console.log(`  verdict      on record as ${lookup.record.filename}, version ${lookup.version}`)
    await finish(0)
  } else if (lookup.outcome === 'unmatched') {
    console.log('  verdict      NOT A DOCUMENT OF RECORD')
    console.log(`               this fingerprint appears in none of the ${lookup.versions} versions of ${assetId}`)
    await finish(1)
  } else {
    // Not a verdict either way. Exit 2 so a script cannot mistake it for one.
    console.log('  verdict      INCOMPLETE')
    console.log(`               version${lookup.unreadable.length === 1 ? '' : 's'} ${lookup.unreadable.join(', ')} could not be read; the rest do not list this fingerprint`)
    await finish(2)
  }
}

const started = Date.now()
const verdict = await verifyAssetRecord(client, synapse, owner, assetId)
const took = ((Date.now() - started) / 1000).toFixed(1)

if (!verdict.avalancheRead) {
  // Unreachable is not unanchored. Exit 2, the same "no verdict" status as an
  // incomplete document check.
  console.log(`COULD NOT READ AVALANCHE. ${verdict.problems.join(' ')}`)
  await finish(2)
}
if (!verdict.anchored) {
  console.log(`NOT ANCHORED. ${verdict.problems.join(' ')}`)
  await finish(1)
}

console.log(`version ${verdict.anchor?.version} anchored ${verdict.anchor?.publishedAt.toISOString()}`)
console.log(`manifest ${verdict.anchor?.manifestCid}`)
console.log(`manifest storage ${verdict.manifestStorageProven ? 'proven' : 'NOT proven'}\n`)

const now = new Date()
const tick = (ok: boolean | null): string => (ok == null ? '?  ' : ok ? 'yes' : 'NO ')
console.log('record                     content  fetched  proven   data set last proven')
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
await finish(verdict.verified ? 0 : 1)
