import { useCallback, useState } from 'react'
import { readAnchoredManifest } from '../lib/asset-record.js'
import { manifestHistory, type ManifestVersion } from '../lib/avalanche.js'
import type { ReadClients } from '../lib/read-clients.js'
import type { VerifyScreenProps } from './verify.js'
import { AnchorDetails, Records } from './records.js'
import { useRead } from './use-read.js'

export function HistoryScreen({ assetId, owner, clients }: VerifyScreenProps) {
  const load = useCallback(() => manifestHistory(clients!.avalanche, owner, assetId), [clients, owner, assetId])
  const { result, refresh } = useRead(clients == null ? null : load)
  return <section>
    <div className="screen-head"><div className="eyebrow">History</div><h1>Published versions</h1><p className="sub mono">{assetId}</p></div>
    <div className="actions"><button className="btn" onClick={refresh} disabled={clients == null || result.state === 'loading'}>Refresh</button></div>
    {result.state === 'loading' && <p role="status">Reading version history from Avalanche...</p>}
    {result.state === 'failed' && <p role="alert">Could not read history: {result.message}</p>}
    {result.state === 'ready' && <div className="timeline record-history">
      {result.value.length === 0 && <p>No versions published.</p>}
      {[...result.value].reverse().map((anchor, index) => <Version key={anchor.version} anchor={anchor} current={index === 0} clients={clients!} assetId={assetId} />)}
    </div>}
  </section>
}

function Version({ anchor, current, clients, assetId }: { anchor: ManifestVersion; current: boolean; clients: ReadClients; assetId: string }) {
  const [open, setOpen] = useState(false)
  return <article className={`ver ${current ? 'current' : ''}`}>
    <div className="head"><h2>Version {anchor.version}</h2>{current && <span className="pill neutral">Current</span>}</div>
    <AnchorDetails anchor={anchor} />
    <button className="btn" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Close records' : 'Inspect records'}</button>
    {open && <VersionRecords anchor={anchor} clients={clients} assetId={assetId} />}
  </article>
}

function VersionRecords({ anchor, clients, assetId }: { anchor: ManifestVersion; clients: ReadClients; assetId: string }) {
  const load = useCallback(() => readAnchoredManifest(clients.filecoin, anchor, assetId), [anchor, clients, assetId])
  const { result, refresh } = useRead(load)
  if (result.state === 'loading') return <p role="status">Fetching version {anchor.version} manifest...</p>
  if (result.state === 'failed') return <div role="alert"><p>{result.message}</p><button className="btn" onClick={refresh}>Retry</button></div>
  return <div className="version-records"><p className="sub record-note">Manifest content matches this version's Avalanche pointer.</p><Records manifest={result.value} synapse={clients.filecoin} /></div>
}
