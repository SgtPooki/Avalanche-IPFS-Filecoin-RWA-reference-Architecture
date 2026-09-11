import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const url = process.argv[2] ?? 'http://127.0.0.1:5181'
const output = process.argv[3] ?? '/tmp/anchorline-qa'
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
  await page.getByRole('button', { name: 'Asset', exact: true }).click()
  await page.getByRole('heading', { name: 'Record set, version 2' }).waitFor()
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
  await first.getByRole('button', { name: 'Inspect records' }).click()
  await first.getByText('tax-assessment-2025.pdf', { exact: true }).waitFor()
  assert.equal(await first.locator('tbody tr').count(), 5)
  const second = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Version 2', exact: true }) })
  await second.getByRole('button', { name: 'Inspect records' }).click()
  await second.getByText('tax-assessment-2026.pdf', { exact: true }).waitFor()
  await screenshot('history-desktop')
  console.log('Both versions loaded')

  await page.setViewportSize({ width: 390, height: 844 })
  await screenshot('history-mobile')
  await page.getByRole('button', { name: 'Asset', exact: true }).click()
  await page.getByRole('heading', { name: 'Record set, version 2' }).waitFor()
  await screenshot('asset-mobile')
  await page.getByRole('button', { name: 'Verify now', exact: true }).click()
  await page.getByRole('heading', { name: 'Verify asset records' }).waitFor()
  await screenshot('verify-mobile')
  await page.route('https://api.avax-test.network/**', (route) => route.abort())
  await page.getByRole('button', { name: 'Asset', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'Could not read the asset' }).waitFor()
  await page.unroute('https://api.avax-test.network/**')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await page.getByRole('heading', { name: 'Record set, version 2' }).waitFor()
  assert.deepEqual(errors, [])
  console.log('PASS: live asset, both historical manifests, downloaded deed bytes, navigation, responsive layout, failed RPC and retry')
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true })
  console.error(await page.locator('main').innerText())
  throw error
} finally { await browser.close() }
