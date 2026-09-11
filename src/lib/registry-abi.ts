/**
 * The parts of `AssetRecordRegistry` this template calls.
 *
 * Written out rather than generated from the Foundry build, so a reader can see
 * the whole onchain surface in one screen and a fork can use the library
 * without running `forge build`. The contract is at
 * `contracts/src/AssetRecordRegistry.sol`; keep these in step.
 */

/** Every read takes the same pair, because assets are namespaced by owner. */
const ownerAndAssetId = [
  { name: 'owner', type: 'address' },
  { name: 'assetId', type: 'string' },
] as const

/** The `ManifestVersion` struct, as returned by `currentManifest` and `history`. */
const manifestVersionComponents = [
  { name: 'manifestCid', type: 'string' },
  { name: 'manifestPieceCid', type: 'string' },
  { name: 'dataSetId', type: 'uint64' },
  { name: 'publishedAt', type: 'uint64' },
] as const

/** Broken out so viem can infer `getLogs` arguments from it. */
export const manifestUpdatedEvent = {
  type: 'event',
  name: 'ManifestUpdated',
  inputs: [
    { name: 'key', type: 'bytes32', indexed: true },
    { name: 'owner', type: 'address', indexed: true },
    { name: 'assetId', type: 'string', indexed: false },
    { name: 'version', type: 'uint256', indexed: false },
    { name: 'manifestCid', type: 'string', indexed: false },
    { name: 'manifestPieceCid', type: 'string', indexed: false },
    { name: 'dataSetId', type: 'uint64', indexed: false },
  ],
} as const

export const registryAbi = [
  {
    type: 'function',
    name: 'setManifest',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assetId', type: 'string' },
      { name: 'manifestCid', type: 'string' },
      { name: 'manifestPieceCid', type: 'string' },
      { name: 'dataSetId', type: 'uint64' },
    ],
    outputs: [{ name: 'version', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'registerAsset',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assetId', type: 'string' },
      { name: 'metadataCid', type: 'string' },
    ],
    outputs: [{ name: 'key', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'currentManifest',
    stateMutability: 'view',
    inputs: ownerAndAssetId,
    outputs: [
      { name: 'current', type: 'tuple', components: manifestVersionComponents },
      { name: 'version', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'history',
    stateMutability: 'view',
    inputs: ownerAndAssetId,
    outputs: [{ name: '', type: 'tuple[]', components: manifestVersionComponents }],
  },
  {
    type: 'function',
    name: 'versionCount',
    stateMutability: 'view',
    inputs: ownerAndAssetId,
    outputs: [{ name: '', type: 'uint256' }],
  },
  manifestUpdatedEvent,
  { type: 'error', name: 'AssetExists', inputs: [] },
  { type: 'error', name: 'UnknownAsset', inputs: [] },
  { type: 'error', name: 'EmptyCid', inputs: [] },
] as const
