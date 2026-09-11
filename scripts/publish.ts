/**
 * Publish a directory to Filecoin and print a link anyone can open.
 *
 * Used for sharing builds: the mockup, a demo recording, a report. Not part of
 * the template's story, just the way work gets sent to people.
 *
 * This does what `filecoin-pin add <dir>` does, through the library rather than
 * the CLI, because the CLI cannot do it. `add` runs a minimum setup check with
 * a file size of zero, and the cost calculation underneath now rejects a zero
 * piece size, so every `add` fails before it packs anything. Traced and filed
 * as filecoin-project/filecoin-pin#719. `executeUpload` is unaffected, which is
 * why the seed script works and this does too.
 *
 *   npm run publish -- path/to/dir
 */

import { readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { calibration } from '@filoz/synapse-sdk'
import { createCarFromPath as packDirectory, executeUpload, initializeSynapse } from 'filecoin-pin'
import type { CID } from 'multiformats/cid'
import { quietLogger } from '../src/lib/filecoin.js'

/**
 * `createCarFromPath` is Node-only, and this project's tsconfig resolves the
 * browser types, where it is typed as always throwing. It runs under Node here.
 * Same asymmetry as `src/lib/cid.profile.test.ts`.
 */
const createCarFromPath = packDirectory as unknown as (
  path: string
) => Promise<{ carPath: string; rootCid: CID; name: string }>

const target = process.argv[2]
if (target == null) throw new Error('usage: npm run publish -- path/to/dir')

const privateKey = process.env.PRIVATE_KEY
if (privateKey == null || !privateKey.startsWith('0x')) {
  throw new Error('PRIVATE_KEY must be set, see .env.example')
}

const logger = quietLogger()
const synapse = await initializeSynapse({ privateKey: privateKey as `0x${string}`, chain: calibration }, logger)

console.log(`packing ${path.resolve(target)}`)
const car = await createCarFromPath(path.resolve(target))
const carBytes = new Uint8Array(await readFile(car.carPath))
console.log(`root      ${car.rootCid.toString()}`)
console.log(`car       ${(carBytes.length / 1_048_576).toFixed(2)} MiB`)

try {
  const started = Date.now()
  const result = await executeUpload(synapse, carBytes, car.rootCid, {
    logger,
    pieceMetadata: { name: car.name },
    onProgress: (event) => process.stdout.write(`\r  ${event.type.padEnd(40)}`),
  })
  process.stdout.write('\r'.padEnd(48))

  console.log(`\npiece     ${result.pieceCid}`)
  console.log(`stored    in ${((Date.now() - started) / 1000).toFixed(0)}s, IPNI ${result.ipniValidated}`)
  for (const copy of result.copies) {
    console.log(`copy      ${copy.role} provider ${copy.providerId} data set ${copy.dataSetId}`)
  }
  // A gateway link is only honest once IPNI says the root is announced.
  console.log(
    result.ipniValidated
      ? `\nhttps://${car.rootCid.toString()}.ipfs.inbrowser.link/`
      : '\nStored, but IPNI has not confirmed the root yet, so a gateway link would not resolve.'
  )
} finally {
  await rm(car.carPath, { force: true })
}
