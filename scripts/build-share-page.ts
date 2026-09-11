/**
 * Build the page that wraps the demo recording.
 *
 * Generated from `seed-output.json` rather than written by hand, so every
 * address, CID and transaction hash on the page is the one actually on chain.
 * A share page whose identifiers do not match the asset is worse than no share
 * page: the audience for this checks.
 *
 *   npm run share -- <dir containing anchorline-demo.mp4 and poster.png>
 */

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import seed from '../seed-output.json' with { type: 'json' }

const outDir = process.argv[2]
if (outDir == null) throw new Error('usage: npm run share -- path/to/dir')

const REPO = 'https://github.com/SgtPooki/anchorline'

/**
 * Explorers, checked in a real browser rather than with curl.
 *
 * `pdp.vxb.ai` is what filecoin-pin still prints, and it now redirects to
 * `pdp.filecoin.cloud/mainnet` with the path thrown away, so a piece link
 * through it silently lands on the wrong network's overview.
 */
const snowtrace = (kind: 'address' | 'tx', value: string): string => `https://testnet.snowtrace.io/${kind}/${value}`
const pdp = (pieceCid: string): string => `https://pdp.filecoin.cloud/calibration/piece/${pieceCid}`
const dataSet = (id: number): string => `https://pdp.filecoin.cloud/calibration/dataset/${id}`
const ipfs = (cid: string): string => `https://${cid}.ipfs.inbrowser.link/`

const latest = seed.versions[seed.versions.length - 1]!
const earlier = seed.versions.slice(0, -1)

/** Long identifiers are proof, but full-length they are visual noise. */
const short = (value: string, head = 6, tail = 5): string =>
  value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`

const escape = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function link(href: string, text: string, title?: string): string {
  return `<a href="${escape(href)}" target="_blank" rel="noopener noreferrer"${
    title == null ? '' : ` title="${escape(title)}"`
  }>${escape(text)}</a>`
}

function proofRow(label: string, value: string): string {
  return `<dt>${escape(label)}</dt><dd>${value}</dd>`
}

const proof = [
  proofRow('Registry, Fuji', link(snowtrace('address', seed.registry), short(seed.registry, 8, 6), seed.registry)),
  proofRow('Publisher', link(snowtrace('address', seed.owner), short(seed.owner, 8, 6), seed.owner)),
  proofRow(
    `Anchored, v${latest.version}`,
    link(snowtrace('tx', latest.transactionHash), short(latest.transactionHash, 8, 6), latest.transactionHash)
  ),
  proofRow(
    `Manifest, v${latest.version}`,
    link(ipfs(latest.manifestCid), short(latest.manifestCid, 8, 6), latest.manifestCid)
  ),
  proofRow(
    'Manifest piece',
    link(pdp(latest.manifestPieceCid), short(latest.manifestPieceCid, 8, 6), latest.manifestPieceCid)
  ),
  proofRow('Data set', link(dataSet(latest.dataSetId), String(latest.dataSetId))),
  proofRow('Asset', `<span class="plain">${escape(seed.assetId)}</span>`),
].join('\n        ')

const records = latest.records
  .map(
    (record) => `          <tr>
            <td><span class="fname">${escape(record.filename)}</span><span class="rtype">${escape(record.type)}</span></td>
            <td>${link(ipfs(record.cid), short(record.cid), record.cid)}</td>
            <td>${link(pdp(record.pieceCid), short(record.pieceCid), record.pieceCid)}</td>
            <td class="num">${record.size.toLocaleString('en-US')}</td>
          </tr>`
  )
  .join('\n')

const olderVersions = earlier
  .map(
    (version) => `          <tr>
            <td>v${version.version}</td>
            <td>${link(snowtrace('tx', version.transactionHash), short(version.transactionHash), version.transactionHash)}</td>
            <td>${link(ipfs(version.manifestCid), short(version.manifestCid), version.manifestCid)}</td>
          </tr>`
  )
  .join('\n')

const CHAPTERS: Array<[seconds: number, label: string, text: string]> = [
  [0, '0:00', 'Verify runs. Reads the pointer from Avalanche, pulls five records from Filecoin, re-hashes each one.'],
  [
    70,
    '1:10',
    'Verified in 68.6 seconds. Every record: the bytes hash to the CID the manifest lists, they are retrievable, and Filecoin proof state is current.',
  ],
  [95, '1:35', 'The real deed, dropped in. Hashed in the browser, found on record.'],
  [130, '2:10', 'The same deed with one name changed. Different fingerprint, in no version anchored on Avalanche. Refused.'],
]

const chapters = CHAPTERS.map(
  ([seconds, label, text]) =>
    `        <button type="button" class="chapter" data-at="${seconds}"><span class="t">${label}</span><span>${escape(
      text
    )}</span></button>`
).join('\n')

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>anchorline, verifying live on Avalanche Fuji and Filecoin Calibration</title>
<meta name="description" content="A forkable worked example for RWAs on Avalanche. Records on Filecoin, addressed by IPFS CID, anchored on Avalanche, verifiable by anyone." />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
  :root{
    --bg:#F5F6F8;--surface:#FFF;--surface-2:#EEF1F4;--line:#DDE1E6;--line-strong:#B9C0C9;
    --text:#0F1216;--muted:#4B5563;--faint:#707B8F;
    --ava:#E84142;--fil:#0090FF;--fil-ink:#0062B8;--ok:#178F5A;
    --display:"Schibsted Grotesk",system-ui,sans-serif;
    --body:"IBM Plex Sans",system-ui,sans-serif;
    --mono:"IBM Plex Mono",ui-monospace,Menlo,monospace;
    --shadow:0 1px 2px rgba(16,21,32,.06),0 8px 24px rgba(16,21,32,.08);
    --anchor:linear-gradient(180deg,var(--ava) 0 26%,var(--line-strong) 26% 74%,var(--fil) 74% 100%);
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--text);font-family:var(--body);font-size:15px;line-height:1.55;padding:28px 16px 72px}
  main{max-width:1080px;margin:0 auto}
  a{color:var(--fil-ink);text-decoration:none;border-bottom:1px solid rgba(0,98,184,.28)}
  a:hover{border-bottom-color:var(--fil-ink)}
  h1{font-family:var(--display);font-weight:800;font-size:32px;letter-spacing:-.02em;margin:0 0 8px;text-wrap:balance}
  h2{font-family:var(--display);font-weight:700;font-size:18px;margin:0 0 10px}
  p{margin:0 0 12px;color:var(--muted)}
  .eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--faint);margin-bottom:10px;display:flex;flex-wrap:wrap;gap:10px}
  .eyebrow a{border:0;color:var(--faint);text-decoration:underline}
  .lede{font-size:16px;max-width:74ch}

  /* On a narrow screen the proof comes before the video: the identifiers are
     the reason to trust the recording, and on mobile a video pushes everything
     else off the first screen. */
  .fold{display:grid;grid-template-columns:1fr;gap:16px;margin-top:20px}
  .fold .proof{order:1}
  .fold .player{order:2}
  @media (min-width:900px){
    .fold{grid-template-columns:1.45fr 1fr;align-items:start}
    .fold .proof{order:2}
    .fold .player{order:1}
  }

  video{display:block;width:100%;max-height:min(52vh,430px);border:1px solid var(--line);border-radius:10px;background:#000}

  /* The anchor line: Avalanche red, through the record, into Filecoin blue.
     Drawn as a pseudo-element rather than border-image, which renders the
     middle segment inconsistently. */
  .proof{position:relative;background:var(--surface);border:1px solid var(--line);border-radius:10px;
    box-shadow:var(--shadow);padding:16px 18px 16px 22px;overflow:hidden}
  .proof::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--anchor)}
  .proof h2{margin-bottom:4px}
  .proof .note{font-size:12.5px;color:var(--faint);margin:0 0 12px}
  .kv{display:grid;grid-template-columns:auto minmax(0,1fr);gap:5px 14px;margin:0;font-size:13px}
  .kv dt{color:var(--faint);white-space:nowrap}
  .kv dd{margin:0;font-family:var(--mono);font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .kv dd .plain{color:var(--text)}

  .chapters{display:grid;gap:2px;margin:16px 0 0;background:var(--surface-2);border-radius:10px;padding:8px}
  .chapter{display:flex;gap:14px;align-items:baseline;width:100%;text-align:left;background:none;border:0;
    font:inherit;color:var(--muted);padding:8px 10px;border-radius:6px;cursor:pointer}
  .chapter:hover{background:var(--surface);color:var(--text)}
  .chapter .t{font-family:var(--mono);font-size:12px;color:var(--fil-ink);min-width:42px}

  .card{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin-top:16px;box-shadow:var(--shadow)}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{text-align:left;font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);font-weight:400;padding:0 10px 8px 0;border-bottom:1px solid var(--line)}
  td{padding:9px 10px 9px 0;border-bottom:1px solid var(--line);font-family:var(--mono);font-size:12.5px;vertical-align:baseline}
  tr:last-child td{border-bottom:0}
  .fname{font-family:var(--body);font-weight:500;display:block;color:var(--text)}
  .rtype{font-size:11px;color:var(--faint)}
  .num{color:var(--faint);text-align:right}
  pre{background:var(--surface-2);border:1px solid var(--line);border-radius:8px;padding:12px 14px;overflow-x:auto;
    font-family:var(--mono);font-size:12.5px;margin:10px 0 0;color:var(--text)}
  .fine{font-size:12.5px;color:var(--faint)}
  .tblwrap{overflow-x:auto}
</style>
</head>
<body>
<main>
  <div class="eyebrow">
    <span>anchorline</span>
    <span>recorded ${escape(seed.seededAt.slice(0, 10))}</span>
    <span>Avalanche Fuji · Filecoin Calibration</span>
    <a href="${REPO}" target="_blank" rel="noopener noreferrer">github.com/SgtPooki/anchorline</a>
  </div>

  <h1>Verifiable offchain records for an Avalanche RWA</h1>
  <p class="lede">A forkable worked example. Documents live on Filecoin and are addressed by their IPFS CID, a manifest CID is anchored on Avalanche, and anyone can check the whole chain of custody by reading both networks directly. Nothing below is mocked, and nothing here uses an issuer key.</p>

  <div class="fold">
    <div class="player">
      <video controls preload="metadata" poster="poster.png" src="anchorline-demo.mp4"></video>
      <div class="chapters">
${chapters}
      </div>
    </div>

    <div class="proof">
      <h2>The asset, on chain</h2>
      <p class="note">Every identifier here is live on a public testnet. Click any of them.</p>
      <dl class="kv">
        ${proof}
      </dl>
    </div>
  </div>

  <div class="card">
    <h2>The records in version ${latest.version}</h2>
    <p class="fine">A synthetic property record: asset metadata, a deed, a parcel record, a tax assessment, and a survey. Version ${latest.version} replaced the 2025 tax assessment with the 2026 one and kept the other four records exactly as they were, so they still point at the pieces they were first stored in.</p>
    <div class="tblwrap">
      <table>
        <thead><tr><th>Record</th><th>Content CID</th><th>Filecoin piece</th><th>Bytes</th></tr></thead>
        <tbody>
${records}
        </tbody>
      </table>
    </div>
  </div>

  ${
    earlier.length === 0
      ? ''
      : `<div class="card">
    <h2>Earlier versions</h2>
    <p class="fine">Nothing is overwritten. Each version is its own manifest and its own transaction, and each stays independently verifiable.</p>
    <div class="tblwrap">
      <table>
        <thead><tr><th>Version</th><th>Anchoring transaction</th><th>Manifest</th></tr></thead>
        <tbody>
${olderVersions}
        </tbody>
      </table>
    </div>
  </div>`
  }

  <div class="card">
    <h2>Run the same check yourself</h2>
    <p class="fine">Verifying needs no wallet, no account, and no key. It reads two public chains and hashes bytes.</p>
    <pre>git clone ${REPO}
cd anchorline
npm install
npm run verify</pre>
  </div>

  <div class="card">
    <h2>About the minute of waiting</h2>
    <p>Most of it is storage providers answering. It is left in rather than cut, because it is what a verifier actually experiences. Anchoring on Avalanche takes about four seconds. Storing a record on Filecoin takes about two minutes, which is why an asset is published ahead of a demo and never during one.</p>
    <p class="fine">Synthetic data throughout. There is no 123 Main Street in Fairview County and there is no Example State. The tampered deed exists only on disk; its fingerprint <span class="mono">${escape(
      short(seed.tamperedDeedCid, 10, 6)
    )}</span> appears in no version and was never uploaded anywhere.</p>
  </div>
</main>
<script>
  // Chapter rows seek the video. Someone who wants the tamper result should not
  // have to scrub for it.
  var video = document.querySelector('video')
  for (var button of document.querySelectorAll('.chapter')) {
    button.addEventListener('click', function () {
      video.currentTime = Number(this.dataset.at)
      video.play()
      video.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }
</script>
</body>
</html>
`

const target = path.resolve(outDir, 'index.html')
await writeFile(target, html)

// Fail loudly rather than shipping a page whose media is missing.
for (const asset of ['anchorline-demo.mp4', 'poster.png']) {
  await readFile(path.resolve(outDir, asset)).catch(() => {
    throw new Error(`${asset} is missing from ${outDir}`)
  })
}
console.log(`wrote ${target}`)
console.log(`  ${latest.records.length} records, ${seed.versions.length} versions, all identifiers from seed-output.json`)
