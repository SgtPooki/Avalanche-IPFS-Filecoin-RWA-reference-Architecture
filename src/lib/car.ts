/**
 * Getting file bytes back out of a CAR.
 *
 * A record is uploaded as a single-file CAR, so retrieving it returns the CAR
 * rather than the document. The verifier needs the document: it re-hashes the
 * file bytes and compares against the manifest, and hashing the CAR instead
 * would compare a container to a fingerprint of its contents and fail every
 * time.
 *
 * Works in Node and in the browser. Nothing here touches the filesystem.
 */

import { unixfs } from '@helia/unixfs'
import { CarReader } from '@ipld/car'
import { BaseBlockstore } from 'blockstore-core'
import type { CID } from 'multiformats/cid'

/**
 * Read-only blockstore backed by the blocks of one CAR.
 *
 * Keyed by CID string because several copies of `multiformats` reach this code
 * and their CID instances do not compare equal across copies.
 */
class CarBlockstore extends BaseBlockstore {
  private readonly blocks = new Map<string, Uint8Array>()

  static async fromBytes(carBytes: Uint8Array): Promise<{ store: CarBlockstore; roots: CID[] }> {
    const reader = await CarReader.fromBytes(carBytes)
    const store = new CarBlockstore()
    for await (const block of reader.blocks()) {
      store.blocks.set(block.cid.toString(), block.bytes)
    }
    return { store, roots: (await reader.getRoots()) as unknown as CID[] }
  }

  // A generator, because that is what the Blockstore interface asks for: reads
  // may stream. These blocks are already in memory, so it yields once.
  *get(key: CID): Generator<Uint8Array> {
    const bytes = this.blocks.get(key.toString())
    if (bytes == null) throw new Error(`the CAR does not contain block ${key.toString()}`)
    yield bytes
  }

  has(key: CID): boolean {
    return this.blocks.has(key.toString())
  }

  put(key: CID): CID {
    throw new Error(`this blockstore is read-only, refusing to store ${key.toString()}`)
  }

  get size(): number {
    return this.blocks.size
  }
}

export class CarExtractionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CarExtractionError'
  }
}

/**
 * Pull one file's bytes out of a CAR.
 *
 * `expectedCid` is the CID the caller believes the CAR holds, normally taken
 * from the manifest. It is checked against the CAR's own root before any bytes
 * are read, so a provider that returns the wrong piece fails here with a clear
 * message rather than further down as a hash mismatch.
 */
export async function extractFileFromCar(carBytes: Uint8Array, expectedCid: string): Promise<Uint8Array> {
  const { store, roots } = await CarBlockstore.fromBytes(carBytes)

  const root = roots[0]
  if (root == null) throw new CarExtractionError('the CAR declares no root')
  if (roots.length > 1) {
    throw new CarExtractionError(`the CAR declares ${roots.length} roots, and a record CAR holds exactly one file`)
  }
  if (root.toString() !== expectedCid) {
    throw new CarExtractionError(`expected a CAR rooted at ${expectedCid}, got one rooted at ${root.toString()}`)
  }

  const fs = unixfs({ blockstore: store })
  const chunks: Uint8Array[] = []
  let total = 0
  // The root goes across as a string, not as the CID object CarReader handed
  // back. `@ipld/car` resolves multiformats 14 while `@helia/unixfs` and
  // `ipfs-unixfs-exporter` nest 13, so a CID built by one fails the other's
  // instanceof check and the exporter rejects it with "Path must be string or
  // CID". Both versions parse the same string. The cast is because Helia's
  // types say CID even though the exporter underneath documents both.
  for await (const chunk of fs.cat(root.toString() as unknown as CID)) {
    chunks.push(chunk)
    total += chunk.length
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return bytes
}
