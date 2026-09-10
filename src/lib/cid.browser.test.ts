/**
 * Spike 1: the CID we compute in the browser has to be the CID filecoin-pin
 * uploads under, or the tamper check is theatre.
 *
 * Two claims are tested, and they are not the same strength.
 *
 * The strong one: for a file that fits in one chunk, `computeFileCid` matches a
 * CID assembled here from the CID and multihash specs alone, out of
 * `crypto.subtle` and a base32 encoder written in this file. Nothing in that
 * oracle comes from Helia or filecoin-pin, so agreement is evidence about the
 * format rather than two copies of one library agreeing with each other. Every
 * file in the demo dataset is under a megabyte, so this covers all of them.
 *
 * The weaker one, for files past the chunk boundary: `computeFileCid` and
 * `createCarFromFile` agree, and the CAR header records the same root. That is
 * a differential test. It would not catch a fault in the shared UnixFS
 * importer underneath both. Pinning a multi-chunk root against an independent
 * implementation needs a second UnixFS encoder, which this repository does not
 * have.
 */

import { CarReader } from '@ipld/car'
import { createCarFromFile } from 'filecoin-pin'
import { describe, expect, it } from 'vitest'
import { computeFileCid } from './cid.js'
import { bytesOfLength, fileOf, MiB } from './test-bytes.js'

const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567'

/** RFC 4648 base32, lowercase, unpadded. Written out so the oracle owes nothing to multiformats. */
function base32(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f]
      bits -= 5
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f]
  return out
}

/**
 * The CID a single-chunk file must have, built straight from the specs.
 *
 * CIDv1 is `<version 0x01><codec><multihash>`, the raw codec is 0x55, and a
 * sha2-256 multihash is `<code 0x12><length 32><digest>`. Base32 CIDs carry
 * the multibase prefix `b`. Under the unixfs-v1-2025 profile a file of one
 * chunk or less is stored as a single raw leaf, so that is the whole CID.
 */
async function rawLeafCid(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer))
  const cidBytes = new Uint8Array(4 + digest.length)
  cidBytes.set([0x01, 0x55, 0x12, 0x20], 0)
  cidBytes.set(digest, 4)
  return `b${base32(cidBytes)}`
}

async function carHoldsEveryByte(carBytes: Uint8Array, size: number): Promise<boolean> {
  const reader = await CarReader.fromBytes(carBytes)
  let blockBytes = 0
  for await (const block of reader.blocks()) blockBytes += block.bytes.length
  return blockBytes >= size
}

async function carHeaderRoot(carBytes: Uint8Array): Promise<string | undefined> {
  const reader = await CarReader.fromBytes(carBytes)
  return (await reader.getRoots())[0]?.toString()
}

/**
 * Sizes chosen around the 1 MiB chunk boundary, which is where a single raw
 * leaf becomes a dag-pb root over several leaves.
 */
const SIZES: Array<[label: string, size: number]> = [
  ['an empty file', 0],
  ['one byte', 1],
  ['a deed-sized document', 240 * 1024],
  ['one byte under the chunk boundary', MiB - 1],
  ['exactly one chunk', MiB],
  ['one byte over the chunk boundary', MiB + 1],
  ['several chunks', 3 * MiB + 7919],
]

const SINGLE_CHUNK = SIZES.filter(([, size]) => size <= MiB)
const MULTI_CHUNK = SIZES.filter(([, size]) => size > MiB)

describe('computeFileCid against the CID and multihash specs', () => {
  // Only single-chunk files, which the profile stores as one raw leaf.
  it.each(SINGLE_CHUNK)('matches the spec-derived CID for %s (%i bytes)', async (_label, size) => {
    const bytes = bytesOfLength(size)
    expect(await computeFileCid(bytes)).toBe(await rawLeafCid(bytes))
  })

  it('agrees with the published CID of the empty file', async () => {
    // The canonical raw-block CID of zero bytes, quotable from outside this repo.
    expect(await computeFileCid(new Uint8Array(0))).toBe('bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku')
  })

  it('switches from a raw leaf to a dag-pb root past the chunk boundary', async () => {
    expect(await computeFileCid(bytesOfLength(MiB))).toMatch(/^bafkrei/)
    expect(await computeFileCid(bytesOfLength(MiB + 1))).toMatch(/^bafybei/)
  })
})

describe('computeFileCid against the CAR that filecoin-pin uploads', () => {
  // The CAR header root is checked in the same test rather than its own,
  // because a test comparing two values that both come out of filecoin-pin
  // would stay green no matter what happened to computeFileCid.
  it.each(SIZES)('is the root of the CAR uploaded for %s (%i bytes)', async (_label, size) => {
    const bytes = bytesOfLength(size)
    const car = await createCarFromFile(fileOf(bytes, 'record.bin'))
    const computed = await computeFileCid(bytes)

    expect(computed).toBe(car.rootCid.toString())
    expect(computed).toBe(await carHeaderRoot(car.carBytes))
  })
})

/**
 * These check the test data, not `computeFileCid`. A mutation to `cid.ts` will
 * not turn them red, and that is the point: they exist because the fixture
 * silently stopped covering the multi-chunk cases once already.
 */
describe('the byte generator used above', () => {
  it.each(MULTI_CHUNK)('produces %s (%i bytes) that does not repeat at the chunk size', async (_label, size) => {
    const car = await createCarFromFile(fileOf(bytesOfLength(size), 'record.bin'))

    // Identical chunks would deduplicate, leaving the CAR smaller than the file.
    expect(await carHoldsEveryByte(car.carBytes, size)).toBe(true)
  })
})

describe('what the CID does and does not depend on', () => {
  it('changes when a single byte of the file changes', async () => {
    const original = bytesOfLength(240 * 1024)
    const tampered = bytesOfLength(240 * 1024)
    tampered[1234] = tampered[1234]! ^ 0x01

    expect(await computeFileCid(tampered)).not.toBe(await computeFileCid(original))
  })

  it('does not change with the filename', async () => {
    const bytes = bytesOfLength(4096)

    expect(await computeFileCid(fileOf(bytes, 'survey.pdf'))).toBe(await computeFileCid(fileOf(bytes, 'deed.pdf')))
  })

  it('does not change between a Uint8Array and a File over the same bytes', async () => {
    const bytes = bytesOfLength(2 * MiB)

    expect(await computeFileCid(fileOf(bytes, 'parcel.json'))).toBe(await computeFileCid(bytes))
  })
})
