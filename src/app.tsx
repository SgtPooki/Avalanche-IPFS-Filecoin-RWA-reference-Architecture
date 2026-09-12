// Seed output selects the asset. Every screen uses read-only clients.

import { useCallback, useEffect, useState } from 'react'
import type { Address } from 'viem'
import seed from '../seed-output.json' with { type: 'json' }
import { type DocumentLookup, findDocumentByCid } from './lib/asset-record.js'
import { type ReadClients, readOnlyClients } from './lib/read-clients.js'
import { TamperScreen } from './screens/tamper.js'
import { VerifyScreen } from './screens/verify.js'
import { AssetScreen } from './screens/asset.js'
import { HistoryScreen } from './screens/history.js'

const ASSET_ID = seed.assetId
const OWNER = seed.owner as Address

const views = { asset: 'Asset', verify: 'Verify', tamper: 'Check a document', history: 'History' } as const
type View = keyof typeof views

export function App() {
  const [view, setView] = useState<View>('verify')
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
    async (cid: string): Promise<DocumentLookup> => {
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
          Anchorline
        </div>
        <nav className="nav">
          {(Object.keys(views) as View[]).map((candidate) => (
            <button
              key={candidate}
              type="button"
              onClick={() => setView(candidate)}
              {...(view === candidate ? { 'aria-current': 'page' as const } : {})}
            >
              {views[candidate]}
            </button>
          ))}
        </nav>
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
        <div hidden={view !== 'verify'}>
          <VerifyScreen assetId={ASSET_ID} owner={OWNER} clients={clients} />
        </div>
        {view === 'asset' && <AssetScreen assetId={ASSET_ID} owner={OWNER} clients={clients} onVerify={() => setView('verify')} />}
        {view === 'history' && <HistoryScreen assetId={ASSET_ID} owner={OWNER} clients={clients} />}
        <div hidden={view !== 'tamper'}>
          <TamperScreen assetId={ASSET_ID} lookup={lookup} ready={clients != null} onOpenHistory={() => setView('history')} />
        </div>
      </main>
    </div>
  )
}
