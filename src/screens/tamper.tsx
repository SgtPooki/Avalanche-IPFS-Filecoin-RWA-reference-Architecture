/**
 * Check a document against the asset.
 *
 * The file is hashed in the browser and never uploaded. That is not a
 * convenience, it is the scenario: a gateway will not serve tampered bytes, so
 * the only way anyone holds a doctored deed is that a person handed it to them.
 *
 * This screen needs no key, no funds, and no writes. It is also the only screen
 * that works with both chains unreachable, which makes it the right first thing
 * to build: if the CID comes out right here, the browser bundle is sound.
 */

import { useCallback, useRef, useState } from 'react'
import { computeFileCid } from '../lib/cid.js'
import type { ManifestRecord } from '../lib/manifest.js'

export interface DocumentMatch {
  version: number
  record: ManifestRecord
}

export interface TamperScreenProps {
  assetId: string
  /** Looks the CID up across every anchored version. Null when nothing matches. */
  lookup: (cid: string) => Promise<DocumentMatch | null>
  /** False while the chain clients are still connecting. */
  ready: boolean
  onOpenHistory?: () => void
}

type Check =
  | { state: 'idle' }
  | { state: 'hashing'; filename: string; size: number }
  | { state: 'searching'; filename: string; size: number; cid: string }
  | { state: 'done'; filename: string; size: number; cid: string; match: DocumentMatch | null }
  | { state: 'failed'; filename: string; message: string }

export function TamperScreen({ assetId, lookup, ready, onOpenHistory }: TamperScreenProps) {
  const [check, setCheck] = useState<Check>({ state: 'idle' })
  const inputRef = useRef<HTMLInputElement>(null)

  const inspect = useCallback(
    async (file: File) => {
      setCheck({ state: 'hashing', filename: file.name, size: file.size })
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const cid = await computeFileCid(bytes)
        // The CID is shown before the lookup finishes. Hashing is instant and
        // reading both chains is not, so there is no reason to hold back the
        // one answer already in hand.
        setCheck({ state: 'searching', filename: file.name, size: file.size, cid })
        setCheck({ state: 'done', filename: file.name, size: file.size, cid, match: await lookup(cid) })
      } catch (cause) {
        setCheck({ state: 'failed', filename: file.name, message: (cause as Error).message })
      }
    },
    [lookup]
  )

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const file = event.dataTransfer.files[0]
      if (file != null) void inspect(file)
    },
    [inspect]
  )

  return (
    <section>
      <div className="screen-head">
        <div className="eyebrow">Verify · document check</div>
        <h1>Check a document against the asset</h1>
        <p className="sub">
          The file is hashed locally. If its fingerprint is not in a manifest anchored on Avalanche, it is not the
          document on record.
        </p>
      </div>

      <div className="split">
        <div className="panel">
          {check.state === 'done' ? (
            <Verdict check={check} assetId={assetId} onOpenHistory={onOpenHistory} />
          ) : (
            <p className="sub">
              {check.state === 'hashing'
                ? `Hashing ${check.filename}…`
                : check.state === 'searching'
                  ? `${check.cid} — looking for it in every version anchored on Avalanche…`
                  : check.state === 'failed'
                    ? `Could not read ${check.filename}: ${check.message}`
                    : ready
                      ? 'Drop a file to check it.'
                      : 'Connecting to Avalanche and Filecoin…'}
            </p>
          )}
        </div>

        <div className="panel">
          <button
            type="button"
            className="drop"
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <strong>Drop a document here or choose a file</strong>
            <div className="sub">Hashed in your browser. Never uploaded.</div>
          </button>
          <input
            ref={inputRef}
            type="file"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file != null) void inspect(file)
            }}
          />
        </div>
      </div>
    </section>
  )
}

function Verdict({
  check,
  assetId,
  onOpenHistory,
}: {
  check: Extract<Check, { state: 'done' }>
  assetId: string
  onOpenHistory?: (() => void) | undefined
}) {
  const onRecord = check.match != null
  return (
    <>
      <div className="verdict">
        {/* Amber, never red: the brand colour must not come to mean "bad". */}
        <div className={onRecord ? 'big ok' : 'big bad'}>{onRecord ? 'ON RECORD' : 'FAILED'}</div>
        <div className="sub">
          {check.filename} · {check.size.toLocaleString('en-US')} bytes
        </div>
      </div>

      <dl className="kv">
        <dt>Fingerprint</dt>
        <dd className="mono">{check.cid}</dd>
      </dl>

      {onRecord ? (
        <p className="sub">
          This is <strong>{check.match?.record.filename}</strong>, on record in version {check.match?.version} of{' '}
          {assetId}.
        </p>
      ) : (
        <>
          <p className="sub">
            This fingerprint appears in no version of {assetId}. Avalanche has never pointed at these bytes.
          </p>
          <div className="callout neutral">
            <strong>This is tampering, not an update.</strong> A legitimate change publishes a new version and records
            it on Avalanche.{' '}
            {onOpenHistory != null && (
              <button type="button" className="linklike" onClick={onOpenHistory}>
                See the version history
              </button>
            )}
          </div>
        </>
      )}
    </>
  )
}
