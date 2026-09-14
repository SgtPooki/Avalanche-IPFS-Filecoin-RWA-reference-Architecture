// Seed output selects the asset unless the URL names another. Every screen
// uses read-only clients.

import { useCallback, useEffect, useState } from 'react'
import { type Address, isAddress } from 'viem'
import seed from '../seed-output.json' with { type: 'json' }
import property from '../data/property.json' with { type: 'json' }
import { type DocumentLookup, findDocumentByCid } from './lib/asset-record.js'
import { type ReadClients, readOnlyClients } from './lib/read-clients.js'
import { TamperScreen } from './screens/tamper.js'
import { VerifyScreen } from './screens/verify.js'
import { AssetScreen } from './screens/asset.js'
import { HistoryScreen } from './screens/history.js'
import { Above, Below, REPO } from './landing.js'

/**
 * `?asset=ID&owner=0x…` points the same read-only app at any asset in the
 * registry, so one hosted copy serves as a verifier for every fork. Anything
 * missing or malformed falls back to the committed seed output.
 */
function selectedAsset(): { assetId: string; label: string; custom: boolean; owner: Address } {
  const params = new URLSearchParams(window.location.search)
  const owner = params.get('owner')
  const assetId = params.get('asset')?.trim()
  const custom = assetId != null && assetId !== ''
  return {
    assetId: custom ? assetId : seed.assetId,
    label: custom ? assetId : `${property.address.street}, ${property.address.city}`,
    custom,
    owner: owner != null && isAddress(owner) ? owner : (seed.owner as Address),
  }
}

const { assetId: ASSET_ID, label: LABEL, custom: CUSTOM, owner: OWNER } = selectedAsset()

const views = { asset: 'Property record', verify: 'Verify', tamper: 'Check a document', history: 'History' } as const
const pageLinks = { '#architecture': 'Architecture', '#demo': 'Demo', '#how': 'How it works', '#build': 'Build it', [REPO]: 'GitHub' }
type View = keyof typeof views

export function App() {
  const [view, setView] = useState<View>('asset')
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
          <span>Filecoin × Avalanche <span className="dim">· RWA reference architecture</span></span>
        </div>
        <nav className="nav">
          {Object.entries(pageLinks).map(([href, label]) => (
            <a key={href} href={href}>{label}</a>
          ))}
        </nav>
      </header>
      <Above />
      <section className="land-sec" id="demo">
        <h2>See it in action: property record</h2>
        <p className="lede">
          The Fairview County Recorder publishes the deed, survey, parcel file and tax assessments for 123 Main Street,
          stores them on Filecoin, and anchors the set on Avalanche. Everything below reads the live testnets. The
          property is synthetic.
        </p>
        {!CUSTOM && (
          <dl className="kv record-identity">
            <dt>Property</dt><dd>{LABEL}</dd>
            <dt>Record type</dt><dd>Property deed, survey, parcel file and tax assessments</dd>
            <dt>Parcel ID</dt><dd className="mono">{property.assessorParcelNumber}</dd>
            <dt>Issuer</dt><dd>{property.issuer.name}</dd>
            <dt>Owner of record</dt><dd>{property.ownerOfRecord}</dd>
          </dl>
        )}
        <div className="top">
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
        </div>
        <main>
          {failed != null && (
            <div className="callout neutral">Could not reach the networks: {failed}</div>
          )}
          <div hidden={view !== 'verify'}>
            <VerifyScreen assetId={ASSET_ID} label={LABEL} owner={OWNER} clients={clients} />
          </div>
          {view === 'asset' && <AssetScreen assetId={ASSET_ID} label={LABEL} owner={OWNER} clients={clients} onVerify={() => setView('verify')} />}
          {view === 'history' && <HistoryScreen assetId={ASSET_ID} label={LABEL} owner={OWNER} clients={clients} />}
          <div hidden={view !== 'tamper'}>
            <TamperScreen label={LABEL} lookup={lookup} ready={clients != null} onOpenHistory={() => setView('history')} />
          </div>
        </main>
      </section>
      <Below />
    </div>
  )
}
