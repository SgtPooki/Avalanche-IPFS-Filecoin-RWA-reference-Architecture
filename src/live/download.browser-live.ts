/**
 * Can a browser fetch a record from Calibration?
 *
 * Node can. The browser is a different question: the download goes to a
 * storage provider's own host, from a page origin that is not that host, so it
 * depends on the provider sending CORS headers. If this fails, the Verify
 * screen cannot be live and the recording changes shape, so it is worth
 * knowing on its own rather than inside a screen.
 *
 * Loaded by scripts/spike-browser-download.mjs, which drives it in chromium.
 */

import { calibration } from '@filoz/synapse-sdk'
import { initializeSynapse } from 'filecoin-pin'
import { computeFileCid } from '../lib/cid.js'
import { fetchRecord, getStorageStatus, quietLogger } from '../lib/filecoin.js'

export interface LiveResult {
  step: string
  ok: boolean
  detail: string
}

export async function downloadFromCalibration(target: {
  owner: `0x${string}`
  pieceCid: string
  cid: string
  dataSetId: number
}): Promise<LiveResult[]> {
  const results: LiveResult[] = []
  const record = async (step: string, run: () => Promise<string>): Promise<void> => {
    try {
      results.push({ step, ok: true, detail: await run() })
    } catch (cause) {
      results.push({ step, ok: false, detail: (cause as Error).message })
    }
  }

  // Read-only: no key in the browser, which is also how the app will do it.
  const synapse = await initializeSynapse(
    { walletAddress: target.owner, readOnly: true, chain: calibration },
    quietLogger()
  )

  await record('connect', async () => `read-only synapse on ${calibration.name}`)

  let bytes: Uint8Array | null = null
  await record('download and extract', async () => {
    bytes = await fetchRecord(synapse, target.pieceCid, target.cid)
    return `${bytes.length} bytes`
  })

  await record('re-hash', async () => {
    if (bytes == null) throw new Error('nothing downloaded')
    const cid = await computeFileCid(bytes)
    if (cid !== target.cid) throw new Error(`got ${cid}, expected ${target.cid}`)
    return cid
  })

  await record('proof state', async () => {
    const status = await getStorageStatus(synapse, { pieceCid: target.pieceCid, dataSetId: target.dataSetId })
    return `last proven ${status.lastProven?.toISOString() ?? 'never'}, overdue ${status.isProofOverdue}`
  })

  return results
}
