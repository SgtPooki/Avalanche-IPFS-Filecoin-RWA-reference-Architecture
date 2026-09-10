/**
 * The dataset's CIDs are anchored on Fuji and pinned on Calibration. If the
 * generator's output moves by a byte, the anchored asset stops matching and
 * the Verify screen fails at the worst possible moment.
 *
 * So the CIDs are written down here. A failure means one of two things: the
 * dataset changed on purpose and the demo asset needs re-seeding, or it
 * changed by accident and the change should be backed out.
 *
 * These literals were produced by `computeFileCid` rather than by an
 * independent encoder, so on their own they only detect change. What makes
 * them trustworthy as values is `src/lib/cid.browser.test.ts`, which pins
 * `computeFileCid` against a CID built from the CID and multihash specs. Every
 * file below is under one chunk, so every CID below is covered by that check.
 *
 * The check that `data/` on disk matches lives in `dataset.files.test.ts`,
 * which reads the filesystem and so is not a unit test.
 */

import { describe, expect, it } from 'vitest'
import { computeFileCid } from '../../src/lib/cid.js'
import { buildDataset } from './dataset.js'

const EXPECTED: Array<[name: string, cid: string, size: number]> = [
  ['property.json', 'bafkreig64pgrtedyfsy3gricwjaq2qnsj24bujn45gaj65yewiugwmwn64', 501],
  ['deed.pdf', 'bafkreidh5qsi5z6uo2thzvynr27ioajoviafqiveunrielhugyj65l6rzu', 2816],
  ['parcel.json', 'bafkreiejmexovymgvlxps3hpq6ez3ac5sjridcypurprugtsseggslaqiq', 1188],
  ['tax-assessment-2025.pdf', 'bafkreiek7fjuel7opibeayam6cfnww54pmyaez2cetk2i3rbpkcsjydkke', 2131],
  ['tax-assessment-2026.pdf', 'bafkreiexhmrobe6ttuahc7ne227kepu75qg2vtmwaxozlgxxzvdx54oxmq', 2130],
  ['survey.pdf', 'bafkreid3kwdoyxzy6i4kxlzp4q3rgs5f7qbseoiely3rbdad6o6ixob2mi', 2496],
  ['deed-tampered.pdf', 'bafkreiausintabvl4n4hvgv2jdmazvy35bg26gku2ufu2bosxhrd7dzxqi', 2818],
]

function fileNamed(name: string): { name: string; type?: string; mimeType: string; bytes: Uint8Array } {
  const file = buildDataset().find((candidate) => candidate.name === name)
  if (file == null) throw new Error(`the dataset has no ${name}`)
  return file
}

function textOf(name: string): string {
  return new TextDecoder('latin1').decode(fileNamed(name).bytes)
}

describe('buildDataset', () => {
  it('lists exactly the pinned files, in the pinned order', () => {
    expect(buildDataset().map((file) => file.name)).toEqual(EXPECTED.map(([name]) => name))
  })

  it.each(EXPECTED)('builds %s to %s, %i bytes', async (name, cid, size) => {
    const file = fileNamed(name)

    expect(file.bytes.length).toBe(size)
    expect(await computeFileCid(file.bytes)).toBe(cid)
  })

  it('produces byte-identical output on a second call', () => {
    expect(buildDataset()).toEqual(buildDataset())
  })
})

describe('the tampered deed', () => {
  it('names a different owner than the real deed', () => {
    expect(textOf('deed.pdf')).toContain('Owner: Example Property LLC')
    expect(textOf('deed-tampered.pdf')).toContain('Owner: Different Property LLC')
  })

  // The demo has to turn on the CID, not on the document looking wrong. The
  // byte streams cannot be compared directly: the owner names differ in length,
  // which moves the content-stream length and every xref offset after it.
  it.each([
    ['the title', 'General warranty deed'],
    ['the instrument number', 'Instrument 2019-0041827'],
    ['the parcel number', '07-14-226-0031'],
    ['the legal description', 'FAIRVIEW HEIGHTS SUBDIVISION'],
    ['the covenants', 'lawfully seized of the premises in fee simple'],
    ['the recording line', 'Recorded 2019-08-14'],
  ])('keeps %s', (_what, text) => {
    expect(textOf('deed.pdf')).toContain(text)
    expect(textOf('deed-tampered.pdf')).toContain(text)
  })

  it('does not mention the real owner anywhere', () => {
    expect(textOf('deed-tampered.pdf')).not.toContain('Example Property LLC')
  })

  it('carries no record type, so it can never enter a manifest', () => {
    expect(fileNamed('deed-tampered.pdf').type).toBeUndefined()
  })
})

describe('record types', () => {
  it('marks the six records that get uploaded', () => {
    expect(buildDataset().filter((file) => file.type != null).map((file) => file.type)).toEqual([
      'property_metadata',
      'deed',
      'parcel_record',
      'tax_assessment',
      'tax_assessment',
      'survey',
    ])
  })

  it.each([
    ['property.json', 'application/json'],
    ['deed.pdf', 'application/pdf'],
    ['parcel.json', 'application/json'],
    ['survey.pdf', 'application/pdf'],
  ])('gives %s the mime type %s', (name, mimeType) => {
    expect(fileNamed(name).mimeType).toBe(mimeType)
  })
})
