/**
 * Drive the browser download spike in chromium, from a real http origin.
 *
 *   node scripts/spike-browser-download.mjs
 */
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const seed = JSON.parse(readFileSync('seed-output.json', 'utf8'))
const version = seed.versions.at(-1)
const deed = version.records.find((r) => r.filename === 'deed.pdf')
const target = { owner: seed.owner, pieceCid: deed.pieceCid, cid: deed.cid, dataSetId: version.dataSetId }

const server = await createServer({ server: { port: 8101 }, logLevel: 'error' })
await server.listen()
const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
const blocked = []
page.on('requestfailed', (r) => blocked.push(`${r.url()} :: ${r.failure()?.errorText}`))

// A page of its own, not the app: vite reloads when it discovers and optimizes
// a new dependency, which destroys the execution context mid-call.
await page.goto('http://localhost:8101/spike-browser.html')
await page.waitForFunction(() => document.getElementById('status')?.textContent === 'ready', null, { timeout: 60000 })
console.log(`origin    ${page.url()}`)
console.log(`piece     ${target.pieceCid}\n`)

const results = await page.evaluate((t) => window.downloadFromCalibration(t), target)

for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${r.step.padEnd(22)} ${r.detail}`)
if (blocked.length > 0) {
  console.log('\nfailed requests (CORS shows up here):')
  for (const b of blocked.slice(0, 8)) console.log('  ' + b)
}
if (errors.length > 0) {
  console.log('\npage errors:')
  for (const e of errors.slice(0, 8)) console.log('  ' + e)
}
console.log(`\n${results.every((r) => r.ok) ? 'BROWSER DOWNLOAD WORKS.' : 'BROWSER DOWNLOAD BROKEN.'}`)
await browser.close(); await server.close()
process.exit(results.every((r) => r.ok) ? 0 : 1)
