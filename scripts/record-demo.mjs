/**
 * Record the demo against the live app, with synthesized narration.
 *
 * Nothing on screen is staged: Verify, Asset, History and the document check
 * run against Avalanche Fuji and Filecoin Calibration through the dev server.
 * The one exception is the publishing segment, which walks the click-through
 * mockup, because storing a record on Filecoin takes about two minutes. That
 * segment is labelled as mockup footage on screen and in the captions.
 *
 * Narration is macOS `say` reading the lines below, so the recording can be
 * rebuilt whenever the app changes. The lines are the ones in
 * docs/demo-script.md; keep the two in step.
 *
 *   node scripts/record-demo.mjs [serverUrl] [outputDir]
 *
 * Writes anchorline-demo.mp4, poster.png, captions.vtt and timeline.json to
 * the output directory. Needs ffmpeg, ffprobe and the Samantha voice.
 */

import { execFile } from 'node:child_process'
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { chromium } from 'playwright'

const run = promisify(execFile)
const url = process.argv[2] ?? 'http://127.0.0.1:5181'
const output = path.resolve(process.argv[3] ?? 'recording')
const clipsDir = path.join(output, 'clips')
const SIZE = { width: 1280, height: 720 }
const REPO = 'github.com/SgtPooki/anchorline'

/** Screen labels. LIVE is the default; MOCKUP marks the one narrated segment. */
const LIVE = 'Live: Avalanche Fuji and Filecoin Calibration'
const MOCKUP = 'Mockup footage: design click-through, not the app'

const say = (text) => ({ text })
const WAIT_NOTE = 'Still waiting on storage providers. Shown at 2x from here; the verdict prints the real time.'
const SPEED = 2

/**
 * Narration, in order. Each scene is a list of lines read back to back, and a
 * scene's lines are spoken while its action runs, so a chain read is never
 * dead air.
 */
const SCRIPT = {
  title: [
    say('Anchorline. Verifiable offchain records for a real-world asset on Avalanche. Everything here runs live on Avalanche Fuji and Filecoin Calibration, except one labelled segment. The narration is synthesized.'),
  ],
  asset: [
    say('This is FAIRVIEW-0031, a synthetic property record set. Avalanche holds one pointer per version: the manifest content identifier, its Filecoin piece, and a data set id. The manifest lists five records. Filecoin providers hold the bytes; Avalanche never stores a document.'),
  ],
  verifyStart: [
    say('Verify needs no wallet, no account, and no key. It reads the pointer from Avalanche, fetches the manifest and every record from Filecoin, re-hashes each one, and reads the storage proof state for the data set.'),
    say('Most of this wait is storage providers answering. Anchoring on Avalanche takes about four seconds. Storing a record takes about two minutes, which is why publishing is never live.'),
    say('The proof time you will see describes the data set a piece sits in, not each file.'),
  ],
  verifyDone: [
    say('Verified. Every record hashes to the content identifier the manifest lists, is retrievable, and sits in a data set with a current storage proof.'),
  ],
  deed: [
    say('Now someone hands you a deed. Drop it in. It is hashed in the browser and never uploaded, then looked for in every version anchored on Avalanche.'),
  ],
  deedDone: [say('On record. This is deed.pdf, exactly as published.')],
  tampered: [
    say('The same deed with one name changed. Different fingerprint. Every version is searched again.'),
  ],
  tamperedDone: [
    say('Failed. No version anchored on Avalanche points at these bytes. This is tampering, not an update.'),
  ],
  history: [
    say('A legitimate change publishes a new version. Version 2 replaced the 2025 tax assessment with the 2026 one and kept the other four records. Version 1 is still there, with its own manifest and its own transaction. Nothing is overwritten.'),
  ],
  publish: [
    say('This last part is the design mockup, not the app. Publishing is never live in a demo, because each record takes about two minutes to store. Every file is fingerprinted in the browser and stored on Filecoin as its own piece.'),
    say('The manifest is stored last. One Avalanche transaction anchors its content identifier, its piece, and the data set id, in about four seconds. The registry appends a version and never overwrites.'),
  ],
  close: [
    say('Fork it. Clone the repository and run npm run verify to check the same asset yourself, with no key. It builds on the Avalanche and Filecoin data bridge from May 2025.'),
  ],
}

async function synthesize() {
  await rm(clipsDir, { recursive: true, force: true })
  await mkdir(clipsDir, { recursive: true })
  for (const [scene, lines] of Object.entries(SCRIPT)) {
    for (const [index, line] of lines.entries()) {
      const base = path.join(clipsDir, `${scene}-${index}`)
      await run('say', ['-v', 'Samantha', '-r', '178', '-o', `${base}.aiff`, line.text])
      await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${base}.aiff`, '-ar', '48000', '-ac', '1', `${base}.wav`])
      const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `${base}.wav`])
      line.file = `${base}.wav`
      line.seconds = Number(stdout.trim())
    }
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

await synthesize()
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

/** Caption bar and screen label, drawn into the page so they are recorded. */
async function overlay() {
  await page.evaluate(({ live }) => {
    if (document.getElementById('demo-caption') != null) return
    const style = document.createElement('style')
    style.textContent = `
      #demo-caption{position:fixed;left:0;right:0;bottom:0;z-index:9999;background:rgba(15,18,22,.92);color:#fff;
        font:500 21px/1.35 "IBM Plex Sans",system-ui,sans-serif;padding:14px 28px 16px;min-height:78px;
        display:flex;align-items:center;justify-content:center;text-align:center;text-wrap:balance}
      #demo-caption:empty{display:none}
      #demo-label{position:fixed;top:10px;right:14px;z-index:9999;font:500 12px/1 "IBM Plex Mono",ui-monospace,monospace;
        letter-spacing:.04em;padding:6px 10px;border-radius:999px;background:#0F1216;color:#fff}
      #demo-label[data-mockup]{background:#B8760F}`
    document.head.append(style)
    const caption = document.createElement('div')
    caption.id = 'demo-caption'
    const label = document.createElement('div')
    label.id = 'demo-label'
    label.textContent = live
    document.body.append(caption, label)
  }, { live: LIVE })
}

async function label(text) {
  await page.evaluate(({ text, mockup }) => {
    const label = document.getElementById('demo-label')
    label.textContent = text
    if (mockup) label.dataset.mockup = ''
    else delete label.dataset.mockup
  }, { text, mockup: text === MOCKUP })
}

/** Speaks one scene: caption each line and hold it for the clip's length. */
async function narrate(scene, { until } = {}) {
  const lines = SCRIPT[scene]
  const pending = until == null ? null : until()
  for (const line of lines) {
    timeline.push({ scene, at: at(), seconds: line.seconds, file: line.file, text: line.text })
    await page.evaluate((text) => { document.getElementById('demo-caption').textContent = text }, line.text)
    await sleep(line.seconds * 1000 + 250)
  }
  await page.evaluate(() => { document.getElementById('demo-caption').textContent = '' })
  if (pending != null) await pending
}

function card(title, lines) {
  return `<!doctype html><html><head><meta charset="utf-8">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@800&family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Mono&display=swap">
  <style>
    body{margin:0;background:#F5F6F8;color:#0F1216;font-family:"IBM Plex Sans",system-ui,sans-serif;height:100vh;display:grid;place-items:center}
    .card{position:relative;padding:36px 44px 36px 52px;max-width:860px}
    .card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:6px;border-radius:3px;
      background:linear-gradient(180deg,#E84142 0 26%,#B9C0C9 26% 74%,#0090FF 74% 100%)}
    h1{font-family:"Schibsted Grotesk",sans-serif;font-weight:800;font-size:46px;letter-spacing:-.02em;margin:0 0 14px;text-wrap:balance}
    p{font-size:20px;line-height:1.45;color:#4B5563;margin:0 0 10px}
    .mono{font-family:"IBM Plex Mono",monospace;font-size:17px;color:#0F1216}
  </style></head><body><div class="card"><h1>${title}</h1>${lines.map((line) => `<p>${line}</p>`).join('')}</div></body></html>`
}

async function showCard(title, lines) {
  await page.setContent(card(title, lines))
  await page.evaluate(() => document.fonts.ready)
  await overlay()
}

const nav = (name) => page.getByRole('button', { name, exact: true })

try {
  await showCard('Verifiable offchain records for an Avalanche RWA', [
    'Documents on Filecoin, addressed by IPFS content identifier, anchored on Avalanche.',
    'Live against Avalanche Fuji and Filecoin Calibration. One segment is labelled mockup footage.',
    'Narration is synthesized speech (macOS Samantha) reading docs/demo-script.md.',
    `<span class="mono">${REPO}</span>`,
  ])
  await narrate('title')

  await page.goto(url)
  await overlay()
  await nav('Asset').click()
  await narrate('asset', { until: () => page.getByRole('heading', { name: 'Record set, version 2' }).waitFor() })

  await nav('Verify').click()
  await nav('Verify now').click()
  const verifyStarted = at()
  const verified = page.getByText('Verified', { exact: true })
  await narrate('verifyStart')
  // Whatever wait is left after the narration is played back at double speed.
  // The caption says so, and the verdict prints the real elapsed time.
  await page.evaluate((text) => { document.getElementById('demo-caption').textContent = text }, WAIT_NOTE)
  timeline.push({ scene: 'wait', at: at(), text: WAIT_NOTE })
  await verified.waitFor()
  const verifySeconds = Number((await page.locator('.verdict .sub').first().innerText()).match(/checked in ([\d.]+)s/)?.[1])
  timeline.push({ scene: 'verified', at: at(), verifySeconds, waitedSeconds: at() - verifyStarted })
  // Bring the per-record table into frame; the caption covers the bottom.
  await page.evaluate(() => window.scrollTo({ top: 200, behavior: 'smooth' }))
  await narrate('verifyDone')

  await nav('Check a document').click()
  await page.locator('input[type=file]').setInputFiles('data/deed.pdf')
  await narrate('deed', { until: () => page.getByText('On record', { exact: true }).waitFor() })
  await narrate('deedDone')
  await page.locator('input[type=file]').setInputFiles('data/deed-tampered.pdf')
  await narrate('tampered', { until: () => page.getByText('Failed', { exact: true }).waitFor() })
  await narrate('tamperedDone')

  await nav('History').click()
  const first = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Version 1', exact: true }) })
  await narrate('history', {
    until: async () => {
      await first.waitFor()
      await first.getByRole('button', { name: 'Inspect records' }).click()
      await first.getByText('tax-assessment-2025.pdf', { exact: true }).waitFor()
      await first.locator('table').scrollIntoViewIfNeeded()
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
      // plays, so the "Anchor to Avalanche" moment lands with the words.
      await sleep(SCRIPT.publish[0].seconds * 1000 + 250 + 1500)
      await page.getByRole('button', { name: 'Build manifest' }).click()
      await sleep(4500)
      await page.getByRole('button', { name: 'Anchor to Avalanche' }).click()
    },
  })
  await sleep(1200)

  await showCard('Fork it', [
    `<span class="mono">git clone https://${REPO}.git</span>`,
    '<span class="mono">npm ci && npm run verify</span>',
    'Verifying needs no key, no wallet and no funds. Publishing needs a funded account on both testnets.',
    'Built on Avalanche. Credit to the Avalanche and Filecoin data bridge, May 2025.',
  ])
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

// The silent part of the Verify wait runs at SPEED. Times after it move up
// by the amount removed, and the narration clips are placed on the edited
// timeline, so nothing spoken is touched.
const wait = timeline.find((entry) => entry.scene === 'wait')
const verdictEntry = timeline.find((entry) => entry.scene === 'verified')
const cutFrom = wait.at
const cutTo = verdictEntry.at
const removed = (cutTo - cutFrom) * (1 - 1 / SPEED)
for (const entry of timeline) {
  if (entry.at >= cutTo) entry.at -= removed
  else if (entry.at > cutFrom) entry.at = cutFrom + (entry.at - cutFrom) / SPEED
}
const picture = [
  `[0:v]trim=end=${cutFrom},setpts=PTS-STARTPTS[v0]`,
  `[0:v]trim=start=${cutFrom}:end=${cutTo},setpts=(PTS-STARTPTS)/${SPEED}[v1]`,
  `[0:v]trim=start=${cutTo},setpts=PTS-STARTPTS[v2]`,
  '[v0][v1][v2]concat=n=3:v=1:a=0[v]',
].join(';')

const clips = timeline.filter((entry) => entry.file != null)
const inputs = clips.flatMap((clip) => ['-i', clip.file])
const delayed = clips.map((clip, index) => `[${index + 1}]adelay=${Math.round(clip.at * 1000)}:all=1[a${index}]`).join(';')
const labels = clips.map((_, index) => `[a${index}]`).join('')
// The clips never overlap, so mixing at unit gain keeps each at its own level.
// apad runs silence to the end of the picture and -shortest stops there.
const mixed = `${picture};${delayed};${labels}amix=inputs=${clips.length}:normalize=0:duration=longest,apad[a]`
const mp4 = path.join(output, 'anchorline-demo.mp4')
await run('ffmpeg', [
  '-y', '-loglevel', 'error', '-i', raw, ...inputs,
  '-filter_complex', mixed,
  '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '25',
  '-c:a', 'aac', '-b:a', '128k', '-shortest', mp4,
])

// Captions as a sidecar track, so the share page can offer them. The wait
// note is included: it is on screen, so it belongs in the transcript too.
const stamp = (seconds) => new Date(seconds * 1000).toISOString().slice(11, 23)
const cues = timeline
  .filter((entry) => entry.text != null)
  .map((entry) => ({ from: entry.at, to: entry.scene === 'wait' ? verdictEntry.at : entry.at + entry.seconds, text: entry.text }))
const vtt = ['WEBVTT', '', ...cues.map((cue) => `${stamp(cue.from)} --> ${stamp(cue.to)}\n${cue.text}\n`)].join('\n')
await writeFile(path.join(output, 'captions.vtt'), vtt)
await writeFile(
  path.join(output, 'timeline.json'),
  JSON.stringify({ recordedAt: new Date(started).toISOString(), url, lead, spedUp: { from: cutFrom, to: cutTo - removed, factor: SPEED, removedSeconds: removed }, timeline }, null, 2)
)

// Poster: the verdict, a beat after Verify finished.
const verdict = timeline.find((entry) => entry.scene === 'verified')
await run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(verdict.at + 1), '-i', mp4, '-frames:v', '1', path.join(output, 'poster.png')])

console.log(`wrote ${mp4}`)
console.log(`  ${(await probe(mp4)).toFixed(1)}s total, verification took ${verdict.verifySeconds}s live, ${removed.toFixed(1)}s of silent waiting removed by playing it at ${SPEED}x`)
