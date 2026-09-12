import { useCallback } from 'react'
import { getAssetRecord } from '../lib/asset-record.js'
import { registry } from '../lib/avalanche.js'
import type { VerifyScreenProps } from './verify.js'
import { AnchorDetails, Records } from './records.js'
import { useRead } from './use-read.js'

export function AssetScreen({ assetId, owner, clients, onVerify }: VerifyScreenProps & { onVerify: () => void }) {
  const load = useCallback(() => getAssetRecord(clients!.avalanche, clients!.filecoin, owner, assetId), [clients, owner, assetId])
  const { result, refresh } = useRead(clients == null ? null : load)
  return <section>
    <div className="screen-head"><div className="eyebrow">Asset</div><h1>{assetId}</h1></div>
    <div className="actions"><button className="btn primary" onClick={onVerify}>Verify now</button><button className="btn" onClick={refresh} disabled={clients == null || result.state === 'loading'}>Refresh</button></div>
    <div className="record-identity">
      <dl className="kv"><dt>Publisher</dt><dd className="mono">{owner}</dd><dt>Registry</dt><dd className="mono"><a href={`${registry.explorer}/address/${registry.address}`} target="_blank" rel="noreferrer">{registry.address}</a></dd></dl>
      <p className="sub">Only this publisher can append versions under this asset id.</p>
    </div>
    {result.state === 'loading' && <p role="status">Reading the current record set...</p>}
    {result.state === 'failed' && <p role="alert">Could not read the asset: {result.message}</p>}
    {result.state === 'ready' && (result.value.anchor == null || result.value.manifest == null ? <p>No versions published.</p> : <>
      <h2>Record set, version {result.value.anchor.version}</h2>
      <AnchorDetails anchor={result.value.anchor} />
      <p className="sub record-note">Manifest content matches the Avalanche pointer. Record contents and storage proofs have not been checked here.</p>
      <Records manifest={result.value.manifest} synapse={clients!.filecoin} />
    </>)}
  </section>
}
