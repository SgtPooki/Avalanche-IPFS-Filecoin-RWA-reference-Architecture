/**
 * Byte fixtures shared by the CID and CAR suites.
 *
 * Test-only. Not exported from anything the app imports.
 */

import { expect } from 'vitest'
import { sha256Hex } from './cid.js'

export const MiB = 1024 * 1024

/**
 * Deterministic pseudo-random bytes from an xorshift32 stream.
 *
 * The stream must not repeat at the 1 MiB chunk size. An earlier generator
 * did, which made every full chunk of a multi-chunk file identical, so the
 * blockstore deduplicated them and the multi-chunk cases exercised a single
 * leaf. `seed` lets a suite use a different stream without reintroducing that.
 */
export function bytesOfLength(length: number, seed = 0x9e3779b9): Uint8Array {
  const bytes = new Uint8Array(length)
  let state = seed
  for (let i = 0; i < length; i++) {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    bytes[i] = state & 0xff
  }
  return bytes
}

/** `Uint8Array<ArrayBufferLike>` does not satisfy `BlobPart` under this tsconfig. */
export function fileOf(bytes: Uint8Array, name: string): File {
  return new File([bytes as unknown as BlobPart], name)
}

/**
 * Byte equality by length and digest.
 *
 * `toEqual` on a multi-megabyte Uint8Array walks it element by element and
 * takes seconds. A 3 MiB case was timing out on the comparison while the code
 * it was testing ran in under three milliseconds.
 */
export async function expectSameBytes(actual: Uint8Array, expected: Uint8Array): Promise<void> {
  expect(actual.length).toBe(expected.length)
  expect(await sha256Hex(actual)).toBe(await sha256Hex(expected))
}
