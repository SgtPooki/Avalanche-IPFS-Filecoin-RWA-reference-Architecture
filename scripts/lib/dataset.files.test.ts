/**
 * Not a unit test. It reads `data/` off the filesystem, so it runs in the
 * `files` project rather than the unit suite.
 *
 * It exists because `data/` is committed. A change to the generator that
 * nobody regenerated would otherwise sit there until the demo tried to upload
 * bytes that no longer match the anchored CIDs.
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildDataset } from './dataset.js'

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data')

describe('the committed dataset in data/', () => {
  it.each(buildDataset().map((file) => file.name))('has %s matching the generator', async (name) => {
    const expected = buildDataset().find((file) => file.name === name)!
    const onDisk = new Uint8Array(await readFile(path.join(DATA_DIR, name)))

    expect(onDisk, `data/${name} is stale, run npm run dataset`).toEqual(expected.bytes)
  })
})
