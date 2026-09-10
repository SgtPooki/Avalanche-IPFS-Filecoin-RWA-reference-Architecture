# anchorline

Verifiable offchain records for tokenized real-world assets, built on Avalanche, with IPFS content identifiers and Filecoin storage proofs.

Status: contract deployed, mockup approved, app in progress. See `docs/build-plan.md` for what is being built and in what order.

## What it shows

An issuer registers a property asset on Avalanche Fuji, uploads its records (deed, parcel record, tax assessment, survey), gets an IPFS CID per file, stores the files on Filecoin, and anchors a manifest CID to the asset. Anyone can then read the pointer from Avalanche, fetch the records, re-hash them, and check that Filecoin is still proving storage. A modified deed fails. A legitimate update publishes a new version and keeps the old one verifiable.

## Building on the Avalanche and Filecoin bridge

Ava Labs and the Filecoin Foundation first connected the two networks in May 2025 with a cross-chain data bridge that let an Avalanche contract confirm a Filecoin storage deal. anchorline takes the next step for asset records:

- Storage providers keep proving possession on a schedule, and the record shows when the last proof happened and when the next one is due.
- Each record set is one CID with an append-only version history on Avalanche. Updates add a version. A changed file fails verification.
- Verification reads Avalanche and Filecoin directly, with no extra service between them.

## Who keeps the record

The issuer stays the record of authority. For a county, that means the county still manages its registry. The chain adds an audit that anyone can run without asking the issuer, and the records and their proofs remain available if the issuer's own systems go down. Documents are public and synthetic in this example. Confidential records need encryption and key management before storage, which this template does not cover.

## Repository

- `mockup/` is the click-through of all eight screens and the identity boards. Open `mockup/index.html` in a browser. The buttons advance the flow.
- `contracts/` is the registry contract, deployed on Fuji, plus an optional ERC-721 mix-in for issuers who already have a token. See `contracts/README.md`.
- `docs/build-plan.md` is the build order and the conventions.

## Networks

Avalanche Fuji (chain id 43113) and Filecoin Calibration. The contract is plain EVM and runs on any EVM chain. Synthetic data only.

## Trademarks

AVAX and Avalanche are trademarks of Ava Labs, Inc. anchorline is built on Avalanche. Filecoin and IPFS are trademarks of their respective foundations.
