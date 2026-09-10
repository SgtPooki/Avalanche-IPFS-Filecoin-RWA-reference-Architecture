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
import { BaseBlockstore } from 'blockstore-core'
import type { CID } from 'multiformats/cid'

/**
 * IPIP-499 profile: 1 MiB chunks, raw leaves, CIDv1, 1024-link DAG width.
 *
 * filecoin-pin exports this same constant, but only from its Node entry:
 * `filecoin-pin/core/unixfs` resolves to `browser.js` under the browser
 * condition, and that file re-exports the CAR builders without
 * `importer-options.js`. Importing it here would pull a Node-only path into
 * the browser bundle, so the value is repeated instead.
 *
 * `cid.profile.test.ts` asserts the two are equal, so the copy cannot drift.
 * Tracked upstream at https://github.com/filecoin-project/filecoin-pin/issues/717.
 */
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
 * A blockstore that throws every block away.
 *
 * The importer only needs somewhere to put blocks; the CID falls out of
 * hashing them on the way past. Keeping them would mean holding the whole DAG
 * in memory, and the tamper check runs on whatever file a visitor drags in.
 *
 * `get` throws rather than returning empty bytes. If a future importer version
 * starts reading blocks back, that has to be a loud failure and not a wrong
 * CID.
 */
class DiscardingBlockstore extends BaseBlockstore {
  put(key: CID): CID {
    return key
  }

  has(): boolean {
    return false
  }

  get(key: CID): never {
    throw new Error(`computeFileCid does not keep blocks, and something asked for ${key.toString()}`)
  }
}

/**
 * Compute the UnixFS CID of a file's bytes without producing a CAR.
 *
 * Nothing is uploaded and nothing is kept. This is what the tamper check runs
 * on a dropped file, and what the upload screen shows before a record is sent.
 *
 * Returns the base32 CIDv1 string, which is what the manifest stores and what
 * every comparison in the verifier is made against. Several copies of
 * `multiformats` end up in the dependency tree; strings compare cleanly across
 * all of them.
 */
export async function computeFileCid(source: FileBytes): Promise<string> {
  const fs = unixfs({ blockstore: new DiscardingBlockstore() })
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
