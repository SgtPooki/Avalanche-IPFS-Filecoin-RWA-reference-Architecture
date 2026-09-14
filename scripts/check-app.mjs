import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import seed from '../seed-output.json' with { type: 'json' }

const url = process.argv[2] ?? 'http://127.0.0.1:5181'
const output = process.argv[3] ?? '/tmp/rwa-qa'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
page.setDefaultTimeout(180_000)
const errors = []
page.on('pageerror', (error) => errors.push(error.message))

async function screenshot(name) {
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: page overflows`)
}

try {
  await page.goto(url)
  await page.getByRole('button', { name: 'Property record', exact: true }).click()
  await page.getByRole('heading', { name: 'Recorded documents, version 2' }).waitFor()
  assert.equal(await page.locator('tbody tr').count(), 5)
  await page.getByText('tax-assessment-2026.pdf', { exact: true }).waitFor()
  await screenshot('asset-desktop')
  console.log('Asset loaded')

  const downloaded = page.waitForEvent('download')
  await page.getByRole('row').filter({ hasText: 'deed.pdf' }).getByRole('button', { name: 'Download' }).click()
  const download = await downloaded
  assert.deepEqual(await readFile(await download.path()), await readFile('data/deed.pdf'))
  console.log('Downloaded deed matches')

  await page.getByRole('button', { name: 'History', exact: true }).click()
  await page.getByRole('heading', { name: 'Version 1', exact: true }).waitFor()
  const first = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Version 1', exact: true }) })
  await first.getByRole('button', { name: 'Inspect documents' }).click()
  await first.getByText('tax-assessment-2025.pdf', { exact: true }).waitFor()
  assert.equal(await first.locator('tbody tr').count(), 5)
  const second = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Version 2', exact: true }) })
  await second.getByRole('button', { name: 'Inspect documents' }).click()
  await second.getByText('tax-assessment-2026.pdf', { exact: true }).waitFor()
  await screenshot('history-desktop')
  console.log('Both versions loaded')

  await page.setViewportSize({ width: 390, height: 844 })
  await screenshot('history-mobile')
  await page.getByRole('button', { name: 'Property record', exact: true }).click()
  await page.getByRole('heading', { name: 'Recorded documents, version 2' }).waitFor()
  await screenshot('asset-mobile')
  await page.getByRole('button', { name: 'Verify now', exact: true }).click()
  await page.getByRole('heading', { name: 'Verify the records for 123 Main Street, Fairview' }).waitFor()
  await screenshot('verify-mobile')
  await page.route('https://api.avax-test.network/**', (route) => route.abort())
  await page.getByRole('button', { name: 'Property record', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'Could not read the property record' }).waitFor()
  await page.unroute('https://api.avax-test.network/**')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await page.getByRole('heading', { name: 'Recorded documents, version 2' }).waitFor()

  // The document check has three outcomes. The third one, "the lookup could
  // not finish", is forced by refusing the version 1 manifest piece, and it
  // must not be reported as tampering.
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('button', { name: 'Check a document', exact: true }).click()
  await page.locator('input[type=file]').setInputFiles('data/deed.pdf')
  await page.getByText('On record', { exact: true }).waitFor()
  const v1Piece = (url) => url.href.includes(seed.versions[0].manifestPieceCid)
  await page.route(v1Piece, (route) => route.abort())
  await page.locator('input[type=file]').setInputFiles('data/deed-tampered.pdf')
  await page.getByText('Incomplete', { exact: true }).waitFor()
  await page.getByRole('alert').filter({ hasText: 'No verdict' }).waitFor()
  assert.equal(await page.getByText('This is tampering').count(), 0)
  await screenshot('check-incomplete')
  await page.unroute(v1Piece)
  // A file input does not fire change for the same file twice; pick another
  // file first so the retry is a real second lookup.
  await page.locator('input[type=file]').setInputFiles('data/deed.pdf')
  await page.getByText('On record', { exact: true }).waitFor()
  await page.locator('input[type=file]').setInputFiles('data/deed-tampered.pdf')
  await page.getByText('Failed', { exact: true }).waitFor()
  await page.getByText('This is tampering', { exact: false }).waitFor()
  console.log('Document check: on record, incomplete without a tampering claim, failed')

  assert.deepEqual(errors, [])
  console.log('PASS: live asset, both historical manifests, downloaded deed bytes, navigation, responsive layout, failed RPC and retry, three document-check outcomes')
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true })
  console.error(await page.locator('main').innerText())
  throw error
} finally { await browser.close() }
