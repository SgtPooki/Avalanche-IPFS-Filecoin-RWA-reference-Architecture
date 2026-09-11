/**
 * The app shell.
 *
 * Screens are added verify-first, because verification is the claim the
 * template makes and the issuer flow is seeded ahead of the recording.
 */

import { useCallback } from 'react'
import { type DocumentMatch, TamperScreen } from './screens/tamper.js'

const ASSET_ID = 'FAIRVIEW-PROP-0031'

export function App() {
  // Wired to the seeded asset next. Until then the tamper screen proves the
  // browser can hash a dropped file and get the same CID the upload used.
  const lookup = useCallback(async (_cid: string): Promise<DocumentMatch | null> => null, [])

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="mark" />
          Verifiable RWA Records
        </div>
      </header>
      <main>
        <TamperScreen assetId={ASSET_ID} lookup={lookup} />
      </main>
    </div>
  )
}
