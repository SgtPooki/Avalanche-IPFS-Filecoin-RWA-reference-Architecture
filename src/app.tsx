/**
 * The app shell.
 *
 * Verify-first, because verification is the claim the template makes. The
 * issuer flow is seeded ahead of the recording: storing one record takes about
 * two minutes, so publishing is never live.
 *
 * Which asset to show comes from `seed-output.json`, written by `npm run seed`.
 * A fork that has not seeded anything yet still gets a working app pointed at
 * the demo asset, because verifying needs no key and no funds.
 */

import { useCallback, useEffect, useState } from 'react'
import type { Address } from 'viem'
import seed from '../seed-output.json' with { type: 'json' }
import { findDocumentByCid } from './lib/asset-record.js'
import { type ReadClients, readOnlyClients } from './lib/read-clients.js'
import { type DocumentMatch, TamperScreen } from './screens/tamper.js'

const ASSET_ID = seed.assetId
const OWNER = seed.owner as Address

export function App() {
  const [clients, setClients] = useState<ReadClients | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    readOnlyClients(OWNER).then(
      (ready) => { if (live) setClients(ready) },
      (cause: Error) => { if (live) setFailed(cause.message) }
    )
    return () => { live = false }
  }, [])

  const lookup = useCallback(
    async (cid: string): Promise<DocumentMatch | null> => {
      if (clients == null) throw new Error('still connecting to Avalanche and Filecoin')
      return findDocumentByCid(clients.avalanche, clients.filecoin, OWNER, ASSET_ID, cid)
    },
    [clients]
  )

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="mark" />
          Verifiable RWA Records
        </div>
        <div className="chains">
          <span className="pill ava"><span className="dot" />Avalanche Fuji</span>
          <span className="pill fil"><span className="dot" />Filecoin Calibration</span>
          <span className="mono dim">{OWNER.slice(0, 6)}…{OWNER.slice(-4)}</span>
        </div>
      </header>
      <main>
        {failed != null && (
          <div className="callout neutral">Could not reach the networks: {failed}</div>
        )}
        <TamperScreen assetId={ASSET_ID} lookup={lookup} ready={clients != null} />
      </main>
    </div>
  )
}
