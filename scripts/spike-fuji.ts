/**
 * Spike: anchor a manifest pointer on Fuji and read it back.
 *
 * The Calibration spike proved storage. This proves the other chain: write a
 * version, read the current pointer, read the history with transaction hashes,
 * and check that the guard refuses an anchor a verifier could not follow.
 *
 * It writes to a throwaway asset id, not the demo asset, so running it does not
 * add junk versions to what the recording shows.
 *
 *   npm run spike:fuji
 */

import {
  anchorManifest,
  currentManifest,
  manifestHistory,
  readClient,
  registry,
  RegistryError,
  validateAnchor,
  writeClient,
} from '../src/lib/avalanche.js'

const privateKey = process.env.PRIVATE_KEY
if (privateKey == null || !privateKey.startsWith('0x')) {
  throw new Error('PRIVATE_KEY must be set, see .env.example')
}

const step = (n: number, what: string): void => console.log(`\n[${n}/4] ${what}`)

// A per-run asset id keeps the demo asset's history clean.
const assetId = `SPIKE-${new Date().toISOString().replace(/[:.]/g, '-')}`
const wallet = writeClient(privateKey as `0x${string}`)
const client = readClient()
const owner = wallet.account!.address

console.log(`registry  ${registry.address} on chain ${registry.chain.id}`)
console.log(`owner     ${owner}`)
console.log(`assetId   ${assetId}`)

step(1, 'Refuse anchors a verifier could not follow')
for (const [what, input] of [
  ['empty piece CID', { assetId, manifestCid: 'bafkreia', manifestPieceCid: '', dataSetId: 1 }],
  ['zero data set', { assetId, manifestCid: 'bafkreia', manifestPieceCid: 'bafkzcibca', dataSetId: 0 }],
] as const) {
  try {
    validateAnchor(input)
    console.log(`    ${what}: NOT REFUSED, the guard is broken`)
    process.exitCode = 1
  } catch (error) {
    if (!(error instanceof RegistryError)) throw error
    console.log(`    ${what}: refused`)
  }
}

step(2, 'Anchor version 1')
const first = await anchorManifest(wallet, {
  assetId,
  manifestCid: 'bafkreig64pgrtedyfsy3gricwjaq2qnsj24bujn45gaj65yewiugwmwn64',
  manifestPieceCid: 'bafkzcibd74eao2wcvlngjfpimalqx3sjjpp6qjusu6nywc3jsfwiszmowxhaqwbr',
  dataSetId: 54,
})
console.log(`    version ${first.version}  block ${first.blockNumber}  tx ${first.transactionHash}`)

step(3, 'Anchor version 2, and confirm the first is not overwritten')
const second = await anchorManifest(wallet, {
  assetId,
  manifestCid: 'bafkreid3kwdoyxzy6i4kxlzp4q3rgs5f7qbseoiely3rbdad6o6ixob2mi',
  manifestPieceCid: 'bafkzcibd74eao2wcvlngjfpimalqx3sjjpp6qjusu6nywc3jsfwiszmowxhaqwbr',
  dataSetId: 54,
})
console.log(`    version ${second.version}  tx ${second.transactionHash}`)

const current = await currentManifest(client, owner, assetId)
console.log(`    current version ${current?.version}, manifest ${current?.manifestCid.slice(0, 16)}…`)

step(4, 'Read the history, with transaction hashes from the logs')
const started = Date.now()
const history = await manifestHistory(client, owner, assetId)
console.log(`    ${history.length} versions in ${((Date.now() - started) / 1000).toFixed(1)}s`)
for (const version of history) {
  const when = version.publishedAt.toISOString()
  console.log(`    v${version.version}  ${when}  data set ${version.dataSetId}  tx ${version.transactionHash ?? 'not matched'}`)
}

const missing = await currentManifest(client, owner, 'ASSET-THAT-WAS-NEVER-ANCHORED')
console.log(`    an unanchored asset reads as ${missing === null ? 'null, not an error' : 'SOMETHING, which is wrong'}`)

const ok =
  history.length === 2 &&
  current?.version === 2 &&
  history.every((v) => v.transactionHash != null) &&
  history[0]!.manifestCid !== history[1]!.manifestCid &&
  missing === null
console.log(`\n${ok ? 'Fuji round trip holds.' : 'FUJI ROUND TRIP BROKEN.'}`)
if (!ok) process.exitCode = 1
