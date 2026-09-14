// Display the verdict and per-record evidence from both public networks.

import { useCallback, useState } from 'react'
import type { Address, PublicClient } from 'viem'
import type { Synapse } from '@filoz/synapse-sdk'
import { type AssetVerdict, type RecordVerdict, verifyAssetRecord, type VerifyProgress } from '../lib/asset-record.js'
import { describeProof } from '../lib/filecoin.js'

export interface VerifyScreenProps {
  assetId: string
  /** How the demo names the property, e.g. its street address. */
  label: string
  owner: Address
  clients: { avalanche: PublicClient; filecoin: Synapse } | null
}

type Run =
  | { state: 'idle' }
  | { state: 'running'; progress: VerifyProgress; started: number }
  | { state: 'done'; verdict: AssetVerdict; seconds: number }
  | { state: 'failed'; message: string }

export function VerifyScreen({ assetId, label, owner, clients }: VerifyScreenProps) {
  const [run, setRun] = useState<Run>({ state: 'idle' })

  const start = useCallback(async () => {
    if (clients == null) return
    const started = Date.now()
    setRun({ state: 'running', progress: { message: 'starting', done: 0, total: 0 }, started })
    try {
      const verdict = await verifyAssetRecord(clients.avalanche, clients.filecoin, owner, assetId, (progress) =>
        setRun({ state: 'running', progress, started })
      )
      setRun({ state: 'done', verdict, seconds: (Date.now() - started) / 1000 })
    } catch (cause) {
      setRun({ state: 'failed', message: (cause as Error).message })
    }
  }, [assetId, clients, owner])

  return (
    <section>
      <div className="screen-head">
        <div className="eyebrow">Verify · anyone, no wallet needed</div>
        <h1>Verify the records for {label}</h1>
        <p className="sub">
          Reads the pointer from Avalanche, fetches the deed, survey, parcel file and tax assessment from Filecoin,
          re-hashes the bytes, and checks the storage proofs. Nothing here trusts the county recorder.
        </p>
      </div>

      <div className="split">
        <div className="panel">
          {run.state === 'done' ? (
            <Verdict verdict={run.verdict} seconds={run.seconds} />
          ) : run.state === 'running' ? (
            <Running progress={run.progress} />
          ) : run.state === 'failed' ? (
            <p className="sub">Verification could not run: {run.message}</p>
          ) : (
            <p className="sub">
              {clients == null ? 'Connecting to Avalanche and Filecoin…' : 'Nothing checked yet.'}
            </p>
          )}
        </div>

        <div className="panel">
          <dl className="kv">
            <dt>Parcel record</dt>
            <dd className="mono">{assetId}</dd>
            <dt>Recorder</dt>
            <dd className="mono">
              {owner.slice(0, 10)}…{owner.slice(-6)}
            </dd>
          </dl>
          <div className="actions" style={{ marginTop: 14 }}>
            <button
              type="button"
              className="btn primary"
              onClick={() => void start()}
              disabled={clients == null || run.state === 'running'}
            >
              {run.state === 'running' ? 'Checking…' : run.state === 'done' ? 'Check again' : 'Verify now'}
            </button>
          </div>
          <p className="fine" style={{ marginTop: 10 }}>
            Reading both chains takes about a minute. Most of that is storage providers answering.
          </p>
        </div>
      </div>

      {run.state === 'done' && <RecordTable records={run.verdict.records} />}
      <WhatVerifiedMeans />
    </section>
  )
}

function Running({ progress }: { progress: VerifyProgress }) {
  return (
    <>
      <div className="verdict">
        <div className="big">Checking</div>
        <div className="sub">{progress.message}</div>
      </div>
      {progress.total > 0 && (
        <p className="sub">
          {progress.done} of {progress.total} records checked
        </p>
      )}
    </>
  )
}

function Verdict({ verdict, seconds }: { verdict: AssetVerdict; seconds: number }) {
  return (
    <>
      <div className="verdict">
        {/* Amber, never red: the brand colour must not come to mean "bad". */}
        <div className={verdict.verified ? 'big ok' : 'big bad'}>{verdict.verified ? 'Verified' : 'Failed'}</div>
        <div className="sub">
          version {verdict.anchor?.version} · checked in {seconds.toFixed(1)}s
        </div>
      </div>

      <dl className="kv">
        <dt>Anchored</dt>
        <dd>{verdict.anchor?.publishedAt.toLocaleString()}</dd>
        <dt>Manifest</dt>
        <dd className="mono">{verdict.anchor?.manifestCid}</dd>
        <dt>Manifest storage</dt>
        <dd>
          <Mark ok={verdict.manifestStorageProven} />
        </dd>
      </dl>

      {verdict.problems.length > 0 && (
        <div className="callout neutral">
          {verdict.problems.map((problem) => (
            <div key={problem}>{problem}</div>
          ))}
        </div>
      )}
    </>
  )
}

function RecordTable({ records }: { records: RecordVerdict[] }) {
  const now = new Date()
  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="panel-title">
        <h3>Per record</h3>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Record</th>
              <th>Content matches CID</th>
              <th>Retrievable</th>
              <th>Data set proof current</th>
              <th>Data set last proven</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.cid}>
                <td>
                  <div className="file">
                    <div>
                      <div className="name">{record.filename}</div>
                      <div className="meta mono">{record.cid.slice(0, 18)}…</div>
                    </div>
                  </div>
                </td>
                <td>
                  <Mark ok={record.contentMatches} />
                </td>
                <td>
                  <Mark ok={record.retrievable} />
                </td>
                <td>
                  <Mark ok={record.storageProven} />
                </td>
                <td className="mono">{record.proof == null ? 'unknown' : describeProof(record.proof, now).lastProven}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Three states. "Unknown" is a check that did not run, which is not a "No". */
function Mark({ ok }: { ok: boolean | null }) {
  return (
    <span className={ok == null ? 'pill neutral' : ok ? 'pill ok' : 'pill warn'}>
      <span className="dot" />
      {ok == null ? 'Unknown' : ok ? 'Yes' : 'No'}
    </span>
  )
}

/**
 * The claim, stated at the level the checks support. A BD conversation goes
 * wrong when "verified" is heard as "Filecoin proved this deed", so the limits
 * are on the same screen as the verdict.
 */
function WhatVerifiedMeans() {
  return (
    <details className="panel" style={{ marginTop: 16 }}>
      <summary>What verified means here</summary>
      <ul className="sub" style={{ margin: '10px 0 0', paddingLeft: 18, display: 'grid', gap: 6 }}>
        <li>The manifest fetched from Filecoin hashes to the CID that Avalanche points at, and it names this property.</li>
        <li>Every record fetched from Filecoin hashes to the CID that manifest lists. Matching bytes mean the document is the one the recorder published. They do not mean its contents are true.</li>
        <li>The data set holding each piece, and the manifest's own piece, has a storage proof that is not overdue. Proof state belongs to the data set, not to each file, and the time shown is derived from the proving schedule that Filecoin reports.</li>
        <li>Nothing here needs a key, an account, or the county's servers. Reading both networks is what makes this an audit anyone can run.</li>
      </ul>
    </details>
  )
}
