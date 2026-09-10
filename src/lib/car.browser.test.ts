/**
 * A record goes up as a CAR and comes back as a CAR. If extraction returns
 * anything other than the original file bytes, every content check fails and
 * the demo says a good record is bad.
 *
 * Round-tripping through `createCarFromFile` is the honest shape here: that is
 * the same call the upload path makes, so the bytes under test are the bytes
 * that would really be stored.
 */

import { createCarFromFile } from 'filecoin-pin'
import { describe, expect, it } from 'vitest'
import { CarExtractionError, extractFileFromCar } from './car.js'
import { computeFileCid } from './cid.js'
import { bytesOfLength as freshBytes, expectSameBytes, fileOf, MiB } from './test-bytes.js'

/** A different stream from the CID suite, so a fixture mix-up cannot pass unnoticed. */
const bytesOfLength = (length: number): Uint8Array => freshBytes(length, 0x1234567)

describe('extractFileFromCar', () => {
  const sizes: Array<[label: string, size: number]> = [
    ['an empty file', 0],
    ['one byte', 1],
    ['a deed-sized document', 2816],
    ['exactly one chunk', MiB],
    ['several chunks', 3 * MiB + 4241],
  ]

  it.each(sizes)('returns the original bytes of %s (%i bytes)', async (_label, size) => {
    const original = bytesOfLength(size)
    const car = await createCarFromFile(fileOf(original, 'deed.pdf'))

    const extracted = await extractFileFromCar(car.carBytes, car.rootCid.toString())

    await expectSameBytes(extracted, original)
  })

  it('returns bytes that hash back to the CID the manifest would carry', async () => {
    const original = bytesOfLength(2816)
    const car = await createCarFromFile(fileOf(original, 'deed.pdf'))
    const cid = await computeFileCid(original)

    const extracted = await extractFileFromCar(car.carBytes, cid)

    expect(await computeFileCid(extracted)).toBe(cid)
  })

  it('refuses a CAR rooted at something other than the CID asked for', async () => {
    const car = await createCarFromFile(fileOf(bytesOfLength(2816), 'deed.pdf'))
    const wanted = await computeFileCid(bytesOfLength(1188))

    await expect(extractFileFromCar(car.carBytes, wanted)).rejects.toThrow(CarExtractionError)
  })

  it('names both CIDs when the CAR is the wrong one, so a mixed-up piece is obvious', async () => {
    const car = await createCarFromFile(fileOf(bytesOfLength(2816), 'deed.pdf'))
    const wanted = await computeFileCid(bytesOfLength(1188))

    await expect(extractFileFromCar(car.carBytes, wanted)).rejects.toThrow(
      new RegExp(`expected a CAR rooted at ${wanted}, got one rooted at ${car.rootCid.toString()}`)
    )
  })

  // Named so a failure points at the cause rather than at the symptom. The
  // exporter rejects a CID object built by a different multiformats copy with
  // "Path must be string or CID", which reads like a bad argument rather than
  // like two versions of one library in the same tree.
  it('works even though @ipld/car and @helia/unixfs resolve different multiformats versions', async () => {
    const original = bytesOfLength(2 * MiB)
    const car = await createCarFromFile(fileOf(original, 'survey.pdf'))

    await expectSameBytes(await extractFileFromCar(car.carBytes, car.rootCid.toString()), original)
  })

  it('rejects bytes that are not a CAR at all', async () => {
    const notACar = new TextEncoder().encode('this is a PDF, not a CAR')

    await expect(extractFileFromCar(notACar, 'bafkreiabc')).rejects.toThrow()
  })
})
