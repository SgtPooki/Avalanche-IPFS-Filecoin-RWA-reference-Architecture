// Hash the local file, then look for its CID in the published history.

import { useCallback, useRef, useState } from 'react'
import type { DocumentLookup } from '../lib/asset-record.js'
import { computeFileCid } from '../lib/cid.js'

export interface TamperScreenProps {
  /** How the demo names the property, e.g. its street address. */
  label: string
  /** Looks the CID up across every anchored version. */
  lookup: (cid: string) => Promise<DocumentLookup>
  /** False while the chain clients are still connecting. */
  ready: boolean
  onOpenHistory?: () => void
}

type Check =
  | { state: 'idle' }
  | { state: 'hashing'; filename: string; size: number }
  | { state: 'searching'; filename: string; size: number; cid: string }
  | { state: 'done'; filename: string; size: number; cid: string; lookup: DocumentLookup }
  | { state: 'failed'; filename: string; message: string }

export function TamperScreen({ label, lookup, ready, onOpenHistory }: TamperScreenProps) {
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
        setCheck({ state: 'done', filename: file.name, size: file.size, cid, lookup: await lookup(cid) })
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
        <h1>Check a document against {label}</h1>
        <p className="sub">
          Drop in a deed, survey or assessment. The file is hashed locally; if its fingerprint is not in a manifest
          anchored on Avalanche, it is not the document on record for this property.
        </p>
      </div>

      <div className="split">
        <div className="panel">
          {check.state === 'done' ? (
            <Verdict check={check} assetId={label} onOpenHistory={onOpenHistory} />
          ) : (
            <p className="sub">
              {check.state === 'hashing'
                ? `Hashing ${check.filename}…`
                : check.state === 'searching'
                  ? `${check.cid}: looking for it in every version anchored on Avalanche...`
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
  const { lookup } = check
  // Three outcomes, not two. A lookup that could not read every version is
  // not a failure and must not be called tampering; it is asked again.
  const headline = lookup.outcome === 'matched' ? 'On record' : lookup.outcome === 'unmatched' ? 'Failed' : 'Incomplete'
  const tone = lookup.outcome === 'matched' ? 'big ok' : lookup.outcome === 'unmatched' ? 'big bad' : 'big'
  return (
    <>
      <div className="verdict">
        {/* Amber, never red: the brand colour must not come to mean "bad". */}
        <div className={tone}>{headline}</div>
        <div className="sub">
          {check.filename} · {check.size.toLocaleString('en-US')} bytes
        </div>
      </div>

      <dl className="kv">
        <dt>Fingerprint</dt>
        <dd className="mono">{check.cid}</dd>
      </dl>

      {lookup.outcome === 'matched' && (
        <p className="sub">
          This is <strong>{lookup.record.filename}</strong>, on record in version {lookup.version} of {assetId}.
          {lookup.unreadable.length > 0 && ` Version${lookup.unreadable.length === 1 ? '' : 's'} ${lookup.unreadable.join(', ')} could not be read; the match stands without them.`}
        </p>
      )}
      {lookup.outcome === 'unmatched' && (
        <>
          <p className="sub">
            This fingerprint appears in none of the {lookup.versions} version{lookup.versions === 1 ? '' : 's'} of {assetId}. Avalanche has never pointed at these bytes.
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
      {lookup.outcome === 'incomplete' && (
        <div className="callout neutral" role="alert">
          <strong>No verdict.</strong> Version{lookup.unreadable.length === 1 ? '' : 's'} {lookup.unreadable.join(', ')} of {lookup.versions} could not be fetched from Filecoin, and the versions that could be read do not list this fingerprint. Check the file again once the network answers.
        </div>
      )}
    </>
  )
}
