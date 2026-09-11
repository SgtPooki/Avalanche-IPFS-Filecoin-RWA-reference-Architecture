import { calibration } from '@filoz/synapse-sdk'
import { initializeSynapse } from 'filecoin-pin'
import { readFileSync } from 'node:fs'
import { quietLogger, storageContext, pieceStatusIn } from './src/lib/filecoin.js'

const seed = JSON.parse(readFileSync('seed-output.json', 'utf8'))
const v = seed.versions.at(-1)
const synapse = await initializeSynapse({ walletAddress: seed.owner, readOnly: true, chain: calibration }, quietLogger())
const ctx = await storageContext(synapse, v.dataSetId)
console.log(`manifest claims dataSetId ${v.dataSetId} for every record\n`)
for (const r of [...v.records, { filename: 'manifest.json', pieceCid: v.manifestPieceCid }]) {
  try {
    const s = await pieceStatusIn(ctx, r.pieceCid)
    console.log(`  ${r.filename.padEnd(26)} in data set ${v.dataSetId}: yes  (pieceId ${s.retrievalUrl ? 'has url' : 'no url'})`)
  } catch (e) {
    console.log(`  ${r.filename.padEnd(26)} in data set ${v.dataSetId}: NO  ${(e as Error).message}`)
  }
}
