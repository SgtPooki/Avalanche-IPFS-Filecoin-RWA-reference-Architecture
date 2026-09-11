/**
 * The Avalanche half: write the pointer, read it back, read the version history.
 *
 * The registry holds a few hundred bytes per asset and no document bytes at
 * all. It is the only thing the issuer signs, and it is where a verifier
 * starts.
 *
 * On reading history: the plan called for `ManifestUpdated` logs from the
 * deploy block. The contract also exposes a `history()` view, which is one call
 * instead of a paginated scan, so the versions come from the view and the logs
 * are read only to attach a transaction hash to each one. Either way there is
 * no indexer and no database, which was the point.
 */

import {
  type Account,
  type Address,
  createPublicClient,
  createWalletClient,
  type Hex,
  http,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { avalancheFuji } from 'viem/chains'
import deployments from '../../contracts/deployments.json' with { type: 'json' }
import { manifestUpdatedEvent, registryAbi } from './registry-abi.js'

const fuji = deployments['avalanche-fuji']

export const registry = {
  address: fuji.AssetRecordRegistry.address as Address,
  chain: avalancheFuji,
  rpcUrl: fuji.rpc,
  /** Floor for log scans. Scanning from genesis on a public RPC times out. */
  deployBlock: BigInt(fuji.AssetRecordRegistry.deployBlock),
  explorer: fuji.explorer,
} as const

export class RegistryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RegistryError'
  }
}

export function readClient(rpcUrl: string = registry.rpcUrl): PublicClient {
  return createPublicClient({ chain: registry.chain, transport: http(rpcUrl) }) as PublicClient
}

export function writeClient(privateKey: Hex, rpcUrl: string = registry.rpcUrl): WalletClient {
  return createWalletClient({ account: privateKeyToAccount(privateKey), chain: registry.chain, transport: http(rpcUrl) })
}

/** One published version of an asset's record set. */
export interface ManifestVersion {
  version: number
  manifestCid: string
  manifestPieceCid: string
  dataSetId: number
  publishedAt: Date
  /** Present when the version was matched to its `ManifestUpdated` log. */
  transactionHash?: Hex
}

export interface AnchorInput {
  assetId: string
  manifestCid: string
  manifestPieceCid: string
  dataSetId: number
}

/**
 * Refuse an anchor a verifier could not follow.
 *
 * The contract only rejects an empty `manifestCid`. Everything else it accepts:
 * an empty `assetId`, an empty piece CID, a zero data set id. Each of those
 * produces a transaction that succeeds on Avalanche and then fails
 * verification, which on a stage looks like the template is broken rather than
 * like the input was. Catch it before spending gas.
 */
export function validateAnchor(input: AnchorInput): void {
  const problems: string[] = []
  if (input.assetId.trim() === '') problems.push('assetId must not be empty')
  if (input.manifestCid.trim() === '') problems.push('manifestCid must not be empty')
  if (input.manifestPieceCid.trim() === '') {
    problems.push('manifestPieceCid must not be empty, or the verifier cannot find the proof state')
  }
  if (!Number.isInteger(input.dataSetId) || input.dataSetId <= 0) {
    problems.push(`dataSetId must be a positive whole number, got ${input.dataSetId}`)
  }
  if (problems.length > 0) {
    throw new RegistryError(`refusing to anchor an unverifiable record:\n  ${problems.join('\n  ')}`)
  }
}

export interface AnchorResult {
  version: number
  transactionHash: Hex
  blockNumber: bigint
}

/**
 * Write a manifest pointer to Avalanche, appending a version.
 *
 * Registers the asset on first use, so a fork does not have to call
 * `registerAsset` separately.
 */
export async function anchorManifest(
  wallet: WalletClient,
  input: AnchorInput,
  rpcUrl: string = registry.rpcUrl
): Promise<AnchorResult> {
  validateAnchor(input)

  const account = wallet.account
  if (account == null) throw new RegistryError('anchorManifest needs a wallet client with an account')

  const publicClient = readClient(rpcUrl)
  const args = [input.assetId, input.manifestCid, input.manifestPieceCid, BigInt(input.dataSetId)] as const

  // Simulate first: a revert here costs nothing and names the custom error,
  // where a failed transaction costs gas and reports a bare status of 0.
  await publicClient.simulateContract({
    address: registry.address,
    abi: registryAbi,
    functionName: 'setManifest',
    args,
    account: account as Account,
  })

  const hash = await wallet.writeContract({
    address: registry.address,
    abi: registryAbi,
    functionName: 'setManifest',
    args,
    account: account as Account,
    chain: registry.chain,
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') {
    throw new RegistryError(`setManifest reverted, transaction ${hash}`)
  }

  const count = await versionCount(publicClient, account.address, input.assetId)
  return { version: count, transactionHash: hash, blockNumber: receipt.blockNumber }
}

export async function versionCount(client: PublicClient, owner: Address, assetId: string): Promise<number> {
  const count = await client.readContract({
    address: registry.address,
    abi: registryAbi,
    functionName: 'versionCount',
    args: [owner, assetId],
  })
  return Number(count)
}

/**
 * The pointer Avalanche currently holds for an asset.
 *
 * Returns null when the asset has no published version, rather than surfacing
 * the contract's `UnknownAsset` revert. "Nothing anchored yet" is a normal
 * state for a verifier to render, not an error.
 */
export async function currentManifest(
  client: PublicClient,
  owner: Address,
  assetId: string
): Promise<ManifestVersion | null> {
  try {
    const [current, version] = await client.readContract({
      address: registry.address,
      abi: registryAbi,
      functionName: 'currentManifest',
      args: [owner, assetId],
    })
    return toVersion(current, Number(version))
  } catch (cause) {
    if (isUnknownAsset(cause)) return null
    throw cause
  }
}

/**
 * Every published version, oldest first, each with the transaction that wrote it.
 *
 * The versions come from the `history()` view. Transaction hashes come from
 * `ManifestUpdated` logs, scanned in chunks because public RPCs cap the range
 * of a single `eth_getLogs` call. A version whose log is not found keeps its
 * data and loses only the hash.
 */
export async function manifestHistory(
  client: PublicClient,
  owner: Address,
  assetId: string,
  options: { chunkSize?: bigint } = {}
): Promise<ManifestVersion[]> {
  const raw = await client.readContract({
    address: registry.address,
    abi: registryAbi,
    functionName: 'history',
    args: [owner, assetId],
  })
  const versions = raw.map((entry, index) => toVersion(entry, index + 1))
  if (versions.length === 0) return versions

  const hashes = await manifestUpdateHashes(client, owner, assetId, options.chunkSize ?? 2_000n, versions.length)
  return versions.map((version) => {
    const hash = hashes.get(version.version)
    return hash == null ? version : { ...version, transactionHash: hash }
  })
}

/**
 * Transaction hashes for an asset's versions, from `ManifestUpdated` logs.
 *
 * Scans backwards from the head rather than forwards from the deploy block,
 * and stops as soon as every version is matched. Anchors are usually recent, so
 * this normally reads one or two chunks instead of the whole chain. Forwards
 * scanning cost grows with every block Fuji produces, which would have made the
 * History screen slower every day for no reason.
 *
 * `owner` is indexed so the RPC filters on it. `assetId` is not, so it is
 * filtered here.
 */
async function manifestUpdateHashes(
  client: PublicClient,
  owner: Address,
  assetId: string,
  chunkSize: bigint,
  wanted: number
): Promise<Map<number, Hex>> {
  // cacheTime 0 on purpose. viem caches getBlockNumber for its polling
  // interval, and waitForTransactionReceipt warms that cache, so a history read
  // straight after an anchor gets a head from before the anchor landed and the
  // newest version silently loses its transaction hash.
  const latest = await client.getBlockNumber({ cacheTime: 0 })
  const hashes = new Map<number, Hex>()

  let to = latest
  while (to >= registry.deployBlock && hashes.size < wanted) {
    const from = to - chunkSize + 1n
    const logs = await client.getLogs({
      address: registry.address,
      event: manifestUpdatedEvent,
      args: { owner },
      fromBlock: from < registry.deployBlock ? registry.deployBlock : from,
      toBlock: to,
    })
    for (const log of logs) {
      if (log.args.assetId !== assetId || log.args.version == null) continue
      hashes.set(Number(log.args.version), log.transactionHash)
    }
    if (from <= registry.deployBlock) break
    to = from - 1n
  }
  return hashes
}

interface RawVersion {
  manifestCid: string
  manifestPieceCid: string
  dataSetId: bigint
  publishedAt: bigint
}

function toVersion(raw: RawVersion, version: number): ManifestVersion {
  return {
    version,
    manifestCid: raw.manifestCid,
    manifestPieceCid: raw.manifestPieceCid,
    dataSetId: Number(raw.dataSetId),
    publishedAt: new Date(Number(raw.publishedAt) * 1000),
  }
}

/** The contract reverts `UnknownAsset()` for an asset with no versions. */
function isUnknownAsset(cause: unknown): boolean {
  return cause instanceof Error && /UnknownAsset/.test(`${cause.message}${(cause as { details?: string }).details ?? ''}`)
}
