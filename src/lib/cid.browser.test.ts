/**
 * Spike 1: the CID we compute in the browser has to be the CID filecoin-pin
 * uploads under, or the tamper check is theatre.
 *
 * Three values must agree for every file:
 *   1. `computeFileCid` over the bytes
 *   2. `createCarFromFile(...).rootCid` from filecoin-pin
 *   3. the root recorded in the CAR header that gets uploaded
 *
 * Sizes are chosen around the 1 MiB chunk boundary, because that is where a
 * single raw leaf turns into a dag-pb root over several leaves.
 */

import { CarReader } from '@ipld/car'
import { createCarFromFile } from 'filecoin-pin'
import { describe, expect, it } from 'vitest'
import { computeFileCid } from './cid.js'

const MiB = 1024 * 1024

/**
 * Deterministic pseudo-random bytes from an xorshift32 stream.
 *
 * The stream must not repeat at the 1 MiB chunk size. An earlier version of
 * this generator did, which made every full chunk of a multi-chunk file
 * identical, so the blockstore deduplicated them and the multi-chunk cases
 * never exercised a real multi-leaf DAG.
 */
function bytesOfLength(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  let state = 0x9e3779b9
  for (let i = 0; i < length; i++) {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    bytes[i] = state & 0xff
  }
  return bytes
}

/** `Uint8Array<ArrayBufferLike>` does not satisfy `BlobPart` under this tsconfig. */
function fileOf(bytes: Uint8Array, name: string): File {
  return new File([bytes as unknown as BlobPart], name)
}

const cases: Array<{ name: string; size: number }> = [
  { name: 'empty file', size: 0 },
  { name: 'one byte', size: 1 },
  { name: 'a deed-sized document', size: 240 * 1024 },
  { name: 'one byte under the chunk boundary', size: MiB - 1 },
  { name: 'exactly one chunk', size: MiB },
  { name: 'one byte over the chunk boundary', size: MiB + 1 },
  { name: 'several chunks', size: 3 * MiB + 7919 },
]

describe('browser file CID matches the filecoin-pin CAR root', () => {
  for (const { name, size } of cases) {
    it(`agrees on ${name} (${size} bytes)`, async () => {
      const bytes = bytesOfLength(size)
      const file = fileOf(bytes, 'record.bin')

      const computed = await computeFileCid(file)
      const car = await createCarFromFile(file)
      const reader = await CarReader.fromBytes(car.carBytes)
      const [carHeaderRoot] = await reader.getRoots()

      expect(computed).toBe(car.rootCid.toString())
      expect(carHeaderRoot?.toString()).toBe(car.rootCid.toString())

      // Every byte of the file has to be in the CAR. Without this, test data
      // that happens to repeat at the chunk size deduplicates into one leaf
      // and the multi-chunk cases prove nothing.
      let blockBytes = 0
      for await (const block of reader.blocks()) blockBytes += block.bytes.length
      expect(blockBytes).toBeGreaterThanOrEqual(size)
    })
  }

  it('gives a different CID when a single byte changes', async () => {
    const original = bytesOfLength(240 * 1024)
    const tampered = bytesOfLength(240 * 1024)
    tampered[1234] = tampered[1234]! ^ 0x01

    const originalCid = await computeFileCid(fileOf(original, 'deed.pdf'))
    const tamperedCid = await computeFileCid(fileOf(tampered, 'deed.pdf'))

    expect(tamperedCid).not.toBe(originalCid)
  })

  it('does not depend on the filename', async () => {
    const bytes = bytesOfLength(4096)
    const asDeed = await computeFileCid(fileOf(bytes, 'deed.pdf'))
    const asSurvey = await computeFileCid(fileOf(bytes, 'survey.pdf'))

    expect(asSurvey).toBe(asDeed)
  })

  it('is stable across a Uint8Array and a File over the same bytes', async () => {
    const bytes = bytesOfLength(2 * MiB)
    const fromBytes = await computeFileCid(bytes)
    const fromFile = await computeFileCid(fileOf(bytes, 'parcel.json'))

    expect(fromFile).toBe(fromBytes)
  })
})
