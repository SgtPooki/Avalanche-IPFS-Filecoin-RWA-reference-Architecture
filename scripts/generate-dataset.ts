/**
 * Write the synthetic dataset to `data/`.
 *
 *   npm run dataset
 *
 * The files are committed, so this only needs running after a change to
 * `scripts/lib/dataset.ts`. Output is byte-for-byte reproducible; if the bytes
 * move, the CIDs move, and `dataset.test.ts` fails until the anchored asset is
 * re-seeded.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDataset } from './lib/dataset.js'

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data')

await mkdir(outDir, { recursive: true })
for (const file of buildDataset()) {
  await writeFile(path.join(outDir, file.name), file.bytes)
  console.log(`${file.name.padEnd(26)} ${file.bytes.length.toLocaleString('en-US').padStart(9)} bytes`)
}
console.log(`\nWrote the dataset to ${path.relative(process.cwd(), outDir)}`)
