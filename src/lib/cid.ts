/**
 * Content addressing for record files.
 *
 * A record's identity is the UnixFS CID of its bytes. The verifier recomputes
 * that CID from bytes it fetched, and the tamper check recomputes it from a
 * file the user drops in, so both paths have to land on the same digits that
 * filecoin-pin produced at upload time.
 *
 * filecoin-pin encodes uploads under the IPIP-499 `unixfs-v1-2025` profile
 * with no wrapping directory, so a single-file CAR's root CID is the file's
 * CID. `importerOptions` below mirrors that setting, and
 * `src/lib/cid.browser.test.ts` holds the two to each other.
 */

import type { AddOptions } from '@helia/unixfs'
import { unixfs } from '@helia/unixfs'
import { MemoryBlockstore } from 'blockstore-core/memory'

/** IPIP-499 profile: 1 MiB chunks, raw leaves, CIDv1, 1024-link DAG width. */
export const UNIXFS_PROFILE = 'unixfs-v1-2025' as const

export const importerOptions: AddOptions = { profile: UNIXFS_PROFILE }

export type FileBytes = Blob | Uint8Array

async function* toByteStream(source: FileBytes): AsyncIterable<Uint8Array> {
  if (source instanceof Uint8Array) {
    yield source
    return
  }

  const reader = source.stream().getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) return
      if (value != null) yield value
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Compute the UnixFS CID of a file's bytes without producing a CAR.
 *
 * Blocks go to a throwaway in-memory blockstore, so nothing is uploaded and
 * nothing is kept. This is what the tamper check runs on a dropped file.
 *
 * Returns the base32 CIDv1 string, which is what the manifest stores and what
 * every comparison in the verifier is made against. Several copies of
 * `multiformats` end up in the dependency tree; strings compare cleanly across
 * all of them.
 */
export async function computeFileCid(source: FileBytes): Promise<string> {
  const fs = unixfs({ blockstore: new MemoryBlockstore() })
  const cid = await fs.addByteStream(toByteStream(source), importerOptions)
  return cid.toString()
}

/** Lowercase hex SHA-256 of a file's bytes, for the manifest's `sha256` field. */
export async function sha256Hex(source: FileBytes): Promise<string> {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(await source.arrayBuffer())
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
