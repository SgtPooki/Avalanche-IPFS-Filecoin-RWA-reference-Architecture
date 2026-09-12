/**
 * Record the demo against the live app, captioned, with no narration.
 *
 * Nothing on screen is staged: Verify, Asset, History and the document check
 * run against Avalanche Fuji and Filecoin Calibration through the dev server.
 * The one exception is the publishing segment, which walks the click-through
 * mockup, because storing a record on Filecoin takes about two minutes. That
 * segment is labelled as mockup footage on screen and in the captions.
 *
 * Captions are the script. Each line is held for as long as it takes to read,
 * and the captions live in a band under the page rather than over it, so no
 * evidence is ever covered. The lines are the ones in docs/demo-script.md;
 * keep the two in step.
 *
 *   node scripts/record-demo.mjs [serverUrl] [outputDir]
 *
 * Writes anchorline-demo.mp4, poster.png, captions.vtt and timeline.json to
 * the output directory. Needs ffmpeg and ffprobe.
 */

import { execFile } from 'node:child_process'
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { chromium } from 'playwright'
import QRCode from 'qrcode'

const run = promisify(execFile)
const url = process.argv[2] ?? 'http://127.0.0.1:5181'
const output = path.resolve(process.argv[3] ?? 'recording')
const SIZE = { width: 1280, height: 720 }
const CAPTION_HEIGHT = 96
const REPO = 'github.com/SgtPooki/anchorline'
const HOSTED = 'https://sgtpooki.github.io/anchorline/'

/** Screen labels. LIVE is the default; MOCKUP marks the one narrated segment. */
const LIVE = 'Live: Avalanche Fuji and Filecoin Calibration'
const MOCKUP = 'Mockup footage: design click-through, not the app'
const WAIT_NOTE = 'Still waiting on the networks. Shown at 2x until they answer; times printed on screen are real.'
const SPEED = 2

/**
 * Reading time for a caption: 170 words a minute, and never under 3.5 s so a
 * short line does not flash. The 250 ms tail is the gap before the next one.
 */
const say = (text) => ({ text, seconds: Math.max(3.5, (text.split(/\s+/).length / 170) * 60) })

/**
 * Captions, in order. Each scene is a list of lines shown back to back, and a
 * scene's lines are shown while its action runs, so a chain read is never
 * dead air.
 */
const SCRIPT = {
  title: [
    say('Anchorline: verifiable offchain records for a real-world asset on Avalanche. Everything here runs live on Avalanche Fuji and Filecoin Calibration, except one labelled segment.'),
  ],
  asset: [
    say('This is FAIRVIEW-0031, a synthetic property record set. Avalanche holds one pointer per version: the manifest content identifier, its Filecoin piece, and a data set id. The manifest lists five records. Filecoin providers hold the bytes; Avalanche never stores a document.'),
  ],
  verifyStart: [
    say('Verify needs no wallet, no account, and no key. It reads the pointer from Avalanche, fetches the manifest and every record from Filecoin, re-hashes each one, and reads the storage proof state for the data set.'),
    say('Most of this wait is storage providers answering. Anchoring on Avalanche takes about four seconds. Storing a record takes about two minutes, which is why publishing is never live.'),
    say('The proof time you will see belongs to the data set a piece sits in, not to each file.'),
  ],
  verifyDone: [
    say('Verified. The manifest and every record hash to the identifiers Avalanche points at, they are retrievable, and their data set has a current storage proof.'),
  ],
  diff: [
    say('Now someone hands you a deed. Two copies exist on disk: the one that was published, and one with a single name changed. Every other byte is the same.'),
  ],
  deed: [
    say('The published copy first. It is hashed in the browser and never uploaded, then looked for in every version anchored on Avalanche.'),
  ],
  deedDone: [say('On record. This is deed.pdf, exactly as published.')],
  tampered: [say('Now the altered copy. Different fingerprint. Every version is searched again.')],
  tamperedDone: [
    say('Failed. No version anchored on Avalanche points at these bytes. This is tampering, not an update.'),
  ],
  history: [
    say('A legitimate change publishes a new version. Version 2 replaced the 2025 tax assessment with the 2026 one and kept the other four records. Version 1 is still there, with its own manifest and its own transaction. Nothing is overwritten.'),
  ],
  historyHold: [
    say('The highlighted rows are the only difference between the two versions. The other four content identifiers are identical.'),
  ],
  publish: [
    say('This last part is the design mockup, not the app. Publishing is never live in a demo, because each record takes about two minutes to store. Every file is fingerprinted in the browser and stored on Filecoin as its own piece.'),
    say('The manifest is stored last. One Avalanche transaction anchors its content identifier, its piece, and the data set id, in about four seconds. The registry appends a version and never overwrites.'),
  ],
  close: [
    say('Verify it yourself from a phone: scan the code, or clone the repository and run npm run verify. No key needed. Anchorline builds on the Avalanche and Filecoin data bridge from May 2025.'),
  ],
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

await mkdir(output, { recursive: true })
for (const stale of await readdir(output)) if (stale.endsWith('.webm')) await rm(path.join(output, stale))

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir: output, size: SIZE }, deviceScaleFactor: 1 })
const started = Date.now()
const page = await context.newPage()
page.setDefaultTimeout(240_000)
const timeline = []
const at = () => (Date.now() - started) / 1000
let total = 0

/**
 * Caption band and screen label, drawn into the page so they are recorded.
 * The page itself is confined to the area above the band, so the caption
 * never covers evidence.
 */
async function overlay() {
  await page.evaluate(({ live, height }) => {
    if (document.getElementById('demo-caption') != null) return
    const style = document.createElement('style')
    style.textContent = `
      html{height:100%;overflow:hidden}
      body{height:calc(100vh - ${height}px);overflow-y:auto;box-sizing:border-box}
      #demo-caption{position:fixed;left:0;right:0;bottom:0;height:${height}px;z-index:9999;background:#0F1216;color:#fff;
        font:500 21px/1.35 "IBM Plex Sans",system-ui,sans-serif;padding:0 40px;
        display:flex;align-items:center;justify-content:center;text-align:center;text-wrap:balance}
      #demo-label{position:fixed;top:10px;right:14px;z-index:9999;font:500 12px/1 "IBM Plex Mono",ui-monospace,monospace;
        letter-spacing:.04em;padding:6px 10px;border-radius:999px;background:#0F1216;color:#fff}
      #demo-label[data-mockup]{background:#B8760F}
      .demo-highlight td{background:rgba(184,118,15,.14)!important}
      .demo-highlight td:first-child{box-shadow:inset 3px 0 0 #B8760F}`
    document.head.append(style)
    const caption = document.createElement('div')
    caption.id = 'demo-caption'
    const label = document.createElement('div')
    label.id = 'demo-label'
    label.textContent = live
    document.body.append(caption, label)
  }, { live: LIVE, height: CAPTION_HEIGHT })
}

async function label(text) {
  await page.evaluate(({ text, mockup }) => {
    const label = document.getElementById('demo-label')
    label.textContent = text
    if (mockup) label.dataset.mockup = ''
    else delete label.dataset.mockup
  }, { text, mockup: text === MOCKUP })
}

const caption = (text) => page.evaluate((text) => { document.getElementById('demo-caption').textContent = text }, text)

/**
 * Shows one scene: caption each line and hold it for its reading time. If the
 * scene's action is still running when the lines end, the wait note goes up
 * and the window until the action finishes is marked, so the mux can play it
 * at SPEED. No caption line is ever inside such a window.
 */
async function narrate(scene, { until } = {}) {
  const lines = SCRIPT[scene]
  let settled = until == null
  const pending = until == null ? null : until().then(() => { settled = true })
  for (const line of lines) {
    timeline.push({ scene, at: at(), seconds: line.seconds, text: line.text })
    await caption(line.text)
    await sleep(line.seconds * 1000 + 250)
  }
  if (pending == null || settled) return
  await caption(WAIT_NOTE)
  timeline.push({ scene: 'wait', at: at(), text: WAIT_NOTE })
  await pending
  timeline.push({ scene: 'resume', at: at() })
}

const CARD_STYLE = `
  body{margin:0;background:#F5F6F8;color:#0F1216;font-family:"IBM Plex Sans",system-ui,sans-serif;height:100vh;display:grid;place-items:center}
  .card{position:relative;padding:36px 44px 36px 52px;max-width:900px}
  .card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:6px;border-radius:3px;
    background:linear-gradient(180deg,#E84142 0 26%,#B9C0C9 26% 74%,#0090FF 74% 100%)}
  h1{font-family:"Schibsted Grotesk",sans-serif;font-weight:800;font-size:44px;letter-spacing:-.02em;margin:0 0 14px;text-wrap:balance}
  p{font-size:20px;line-height:1.45;color:#4B5563;margin:0 0 10px}
  .mono{font-family:"IBM Plex Mono",monospace;font-size:17px;color:#0F1216}
  .row{display:flex;gap:36px;align-items:center}
  .qr{width:220px;height:220px;flex:none;background:#fff;padding:10px;border:1px solid #DDE1E6;border-radius:8px}
  .qr svg{width:100%;height:100%;display:block}
  .docs{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:8px}
  .doc{background:#fff;border:1px solid #DDE1E6;border-radius:8px;padding:18px 20px;font-family:"IBM Plex Mono",monospace;font-size:15px;line-height:1.7;color:#4B5563}
  .doc h2{font-family:"IBM Plex Sans",sans-serif;font-size:14px;font-weight:600;margin:0 0 8px;color:#0F1216}
  .doc .name{font-size:12px;color:#707B8F;margin-bottom:10px}
  .doc b{color:#0F1216;font-weight:500}
  .doc mark{background:rgba(184,118,15,.18);color:#0F1216;padding:0 3px;border-radius:3px}
  .fine{font-size:14px;color:#707B8F}`

function card(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono&display=swap">
  <style>${CARD_STYLE}</style></head><body><div class="card"><h1>${title}</h1>${body}</div></body></html>`
}

async function showCard(title, body) {
  await page.setContent(card(title, body))
  await page.evaluate(() => document.fonts.ready)
  await overlay()
}

/** The deed excerpts, from the two PDFs' text. Only the owner line differs. */
const deedExcerpt = (owner, changed) => `
  <div class="doc">
    <h2>General warranty deed</h2>
    <div class="name">${changed ? 'data/deed-tampered.pdf' : 'data/deed.pdf'}</div>
    Grantee of record<br>
    <b>Owner: ${changed ? `<mark>${owner}</mark>` : owner}</b><br>
    Property: 123 Main Street, Fairview, Example State<br>
    Assessor parcel number 07-14-226-0031
  </div>`

const nav = (name) => page.getByRole('button', { name, exact: true })

try {
  await showCard('Verifiable offchain records for an Avalanche RWA', `
    <p>Documents on Filecoin, addressed by IPFS content identifier, anchored on Avalanche.</p>
    <p>Live against Avalanche Fuji and Filecoin Calibration. One segment is labelled mockup footage. Captions only, no narration.</p>
    <p class="mono">${REPO}</p>`)
  await narrate('title')

  await page.goto(url)
  await overlay()
  await nav('Asset').click()
  await narrate('asset', { until: () => page.getByRole('heading', { name: 'Record set, version 2' }).waitFor() })

  await nav('Verify').click()
  await nav('Verify now').click()
  const verifyStarted = at()
  const verified = page.getByText('Verified', { exact: true })
  await narrate('verifyStart', { until: () => verified.waitFor() })
  const verifySeconds = Number((await page.locator('.verdict .sub').first().innerText()).match(/checked in ([\d.]+)s/)?.[1])
  timeline.push({ scene: 'verified', at: at(), verifySeconds, waitedSeconds: at() - verifyStarted })
  // Bring the per-record table into frame.
  await page.evaluate(() => document.body.scrollTo({ top: 230, behavior: 'smooth' }))
  await narrate('verifyDone')

  // The owner-line change, shown before the check so the failure that follows
  // is about a document the viewer has seen.
  await showCard('Two deeds', `
    <div class="docs">${deedExcerpt('Example Property LLC', false)}${deedExcerpt('Different Property LLC', true)}</div>
    <p class="fine" style="margin-top:14px">Excerpts from the two PDFs on disk. One name differs; everything else is byte for byte the same.</p>`)
  await narrate('diff')

  await page.goto(url)
  await overlay()
  await nav('Check a document').click()
  await page.locator('input[type=file]').setInputFiles('data/deed.pdf')
  await narrate('deed', { until: () => page.getByText('On record', { exact: true }).waitFor() })
  await narrate('deedDone')
  await page.locator('input[type=file]').setInputFiles('data/deed-tampered.pdf')
  await narrate('tampered', { until: () => page.getByText('Failed', { exact: true }).waitFor() })
  await narrate('tamperedDone')

  await nav('History').click()
  const first = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Version 1', exact: true }) })
  const second = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Version 2', exact: true }) })
  await narrate('history', {
    until: async () => {
      await first.waitFor()
      await second.getByRole('button', { name: 'Inspect records' }).click()
      await second.getByText('tax-assessment-2026.pdf', { exact: true }).waitFor()
      await first.getByRole('button', { name: 'Inspect records' }).click()
      await first.getByText('tax-assessment-2025.pdf', { exact: true }).waitFor()
    },
  })
  // Hold on the one row that changed, in both tables.
  await page.evaluate(() => {
    for (const row of document.querySelectorAll('tbody tr')) {
      if (row.textContent.includes('tax-assessment')) row.classList.add('demo-highlight')
    }
  })
  await second.locator('tbody tr.demo-highlight').scrollIntoViewIfNeeded()
  await narrate('historyHold', {
    until: async () => {
      await sleep(3000)
      await first.locator('tbody tr.demo-highlight').scrollIntoViewIfNeeded()
    },
  })

  await page.goto(`${url}/mockup/index.html`)
  await page.evaluate(() => document.fonts.ready)
  await overlay()
  await label(MOCKUP)
  await page.locator('#flow button[data-n="2"]').click()
  await narrate('publish', {
    until: async () => {
      // Advance to the manifest and anchor screens while the second line
      // shows, so the "Anchor to Avalanche" moment lands with the words.
      await sleep(SCRIPT.publish[0].seconds * 1000 + 250 + 1500)
      await page.getByRole('button', { name: 'Build manifest' }).click()
      await sleep(4500)
      await page.getByRole('button', { name: 'Anchor to Avalanche' }).click()
    },
  })
  await sleep(1200)

  const qr = await QRCode.toString(HOSTED, { type: 'svg', margin: 0, color: { dark: '#0F1216', light: '#FFFFFF' } })
  await showCard('Verify it yourself', `
    <div class="row">
      <div class="qr">${qr}</div>
      <div>
        <p class="mono">${HOSTED.replace('https://', '')}</p>
        <p>The same app, hosted read-only. It holds no key.</p>
        <p class="mono">git clone https://${REPO}.git<br>npm ci &amp;&amp; npm run verify</p>
        <p>Built on Avalanche. Credit to the Avalanche and Filecoin data bridge, May 2025.</p>
      </div>
    </div>`)
  await narrate('close')
  await sleep(1500)
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png') })
  throw error
} finally {
  total = at()
  await context.close()
  await browser.close()
  timeline.push({ scene: 'end', at: total })
}

// Playwright names the video after the page; give it a stable name.
const webm = (await readdir(output)).find((name) => name.endsWith('.webm'))
const raw = path.join(output, 'raw.webm')
await rename(path.join(output, webm), raw)

// The capture starts a little before this script's clock does, so the
// difference between the picture's length and the clock's is added to every
// time below.
const probe = async (file) => Number((await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])).stdout)
const lead = Math.max(0, (await probe(raw)) - total)
for (const entry of timeline) entry.at += lead

// Every silent wait window runs at SPEED. Later times move up by the amount
// removed so far, so the captions file and the chapters seek to the picture.
const windows = []
for (const [index, entry] of timeline.entries()) {
  if (entry.scene === 'wait') windows.push({ from: entry.at, to: timeline[index + 1].at })
}
const segments = []
let cursor = 0
for (const window of windows) {
  segments.push(`trim=start=${cursor}:end=${window.from},setpts=PTS-STARTPTS`)
  segments.push(`trim=start=${window.from}:end=${window.to},setpts=(PTS-STARTPTS)/${SPEED}`)
  cursor = window.to
}
segments.push(`trim=start=${cursor},setpts=PTS-STARTPTS`)
const picture = [
  ...segments.map((segment, index) => `[0:v]${segment}[v${index}]`),
  `${segments.map((_, index) => `[v${index}]`).join('')}concat=n=${segments.length}:v=1:a=0[v]`,
].join(';')
for (const entry of timeline) {
  let shifted = entry.at
  for (const window of windows) {
    if (entry.at >= window.to) shifted -= (window.to - window.from) * (1 - 1 / SPEED)
    else if (entry.at > window.from) shifted -= (entry.at - window.from) * (1 - 1 / SPEED)
  }
  entry.at = shifted
}
const removed = windows.reduce((sum, window) => sum + (window.to - window.from) * (1 - 1 / SPEED), 0)
const verdictEntry = timeline.find((entry) => entry.scene === 'verified')

const mp4 = path.join(output, 'anchorline-demo.mp4')
await run('ffmpeg', [
  '-y', '-loglevel', 'error', '-i', raw,
  '-filter_complex', picture,
  '-map', '[v]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '25', '-an', mp4,
])

// Captions as a sidecar track too, so the share page can offer them as text.
const stamp = (seconds) => new Date(seconds * 1000).toISOString().slice(11, 23)
const cues = timeline
  .map((entry, index) => ({ entry, next: timeline[index + 1] }))
  .filter(({ entry }) => entry.text != null)
  .map(({ entry, next }) => ({ from: entry.at, to: entry.scene === 'wait' ? next.at : entry.at + entry.seconds, text: entry.text }))
const vtt = ['WEBVTT', '', ...cues.map((cue) => `${stamp(cue.from)} --> ${stamp(cue.to)}\n${cue.text}\n`)].join('\n')
await writeFile(path.join(output, 'captions.vtt'), vtt)
await writeFile(
  path.join(output, 'timeline.json'),
  JSON.stringify({ recordedAt: new Date(started).toISOString(), url, lead, spedUp: { windows: windows.length, factor: SPEED, removedSeconds: removed }, timeline }, null, 2)
)

// Poster: the verdict, a beat after Verify finished.
await run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(verdictEntry.at + 1), '-i', mp4, '-frames:v', '1', path.join(output, 'poster.png')])

console.log(`wrote ${mp4}`)
console.log(`  ${(await probe(mp4)).toFixed(1)}s total, verification took ${verdictEntry.verifySeconds}s live, ${removed.toFixed(1)}s of silent waiting removed by playing ${windows.length} windows at ${SPEED}x`)
