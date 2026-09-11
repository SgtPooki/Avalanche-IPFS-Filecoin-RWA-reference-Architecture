/**
 * Read-only clients for both chains.
 *
 * Every screen needs the same pair and none of them needs a key, so this is one
 * place rather than a duplicated four lines per screen. Verifying is a public
 * act: it reads Avalanche, reads Filecoin, and hashes bytes. Nothing here can
 * sign anything, which is the point and is worth being structurally true rather
 * than merely observed.
 */

import { calibration, type Synapse } from '@filoz/synapse-sdk'
import { initializeSynapse } from 'filecoin-pin'
import type { Address, PublicClient } from 'viem'
import { readClient } from './avalanche.js'
import { quietLogger } from './filecoin.js'

export interface ReadClients {
  avalanche: PublicClient
  filecoin: Synapse
}

/**
 * `owner` is the account whose assets are being read. Synapse wants an address
 * to scope reads to; it never signs, because `readOnly` is set.
 */
export async function readOnlyClients(owner: Address): Promise<ReadClients> {
  return {
    avalanche: readClient(),
    filecoin: await initializeSynapse({ walletAddress: owner, readOnly: true, chain: calibration }, quietLogger()),
  }
}
