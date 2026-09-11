import { useState } from 'react'
import type { Synapse } from '@filoz/synapse-sdk'
import type { Manifest, ManifestRecord } from '../lib/manifest.js'
import { computeFileCid } from '../lib/cid.js'
import { fetchRecord, getStorageStatus } from '../lib/filecoin.js'
import { registry, type ManifestVersion } from '../lib/avalanche.js'

export function AnchorDetails({ anchor }: { anchor: ManifestVersion }) {
  return <dl className="kv anchor-details">
    <dt>Manifest CID</dt><dd className="mono">{anchor.manifestCid}</dd>
    <dt>Published</dt><dd>{anchor.publishedAt.toLocaleString()}</dd>
    <dt>Filecoin piece</dt><dd className="mono"><a href={`https://pdp.filecoin.cloud/calibration/piece/${anchor.manifestPieceCid}`} target="_blank" rel="noreferrer">{anchor.manifestPieceCid}</a></dd>
    <dt>Data set</dt><dd>{anchor.dataSetId}</dd>
    {anchor.transactionHash && <><dt>Transaction</dt><dd className="mono"><a href={`${registry.explorer}/tx/${anchor.transactionHash}`} target="_blank" rel="noreferrer">{anchor.transactionHash}</a></dd></>}
  </dl>
}

export function Records({ manifest, synapse }: { manifest: Manifest; synapse: Synapse }) {
  return <>
    <div className="tbl-wrap"><table className="records-table">
      <thead><tr><th>Record</th><th>Content CID</th><th>Bytes</th><th>Filecoin</th><th>Document</th></tr></thead>
      <tbody>{manifest.records.map((record) => <tr key={record.filename}>
        <td><strong>{record.filename}</strong><div className="meta">{record.type}</div></td>
        <td><span className="cid short" title={record.cid}>{record.cid}</span></td>
        <td>{record.size.toLocaleString('en-US')}</td>
        <td><a href={`https://pdp.filecoin.cloud/calibration/piece/${record.pieceCid}`} target="_blank" rel="noreferrer">Storage proofs</a></td>
        <td><Download record={record} synapse={synapse} /></td>
      </tr>)}</tbody>
    </table></div>
    <details className="manifest-json"><summary>Manifest JSON</summary><pre className="pre">{JSON.stringify(manifest, null, 2)}</pre></details>
  </>
}

function Download({ record, synapse }: { record: ManifestRecord; synapse: Synapse }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function download() {
    setBusy(true)
    setError(null)
    try {
      const proof = await getStorageStatus(synapse, record)
      const bytes = await fetchRecord(synapse, record.pieceCid, record.cid, { retrievalUrl: proof.retrievalUrl })
      if (await computeFileCid(bytes) !== record.cid) throw new Error('Downloaded content does not match the record CID')
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: record.mimeType }))
      const link = document.createElement('a')
      link.href = url
      link.download = record.filename
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (cause) { setError(String(cause)) }
    finally { setBusy(false) }
  }
  return <><button className="linklike" disabled={busy} onClick={() => void download()}>{busy ? 'Fetching...' : 'Download'}</button>{error && <p role="alert">{error}</p>}</>
}
