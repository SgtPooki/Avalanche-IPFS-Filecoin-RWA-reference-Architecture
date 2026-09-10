# anchorline

Verifiable offchain records for tokenized real-world assets, built on Avalanche, with IPFS content identifiers and Filecoin storage proofs.

Status: contract deployed, mockup approved, app in progress. See `docs/build-plan.md` for what is being built and in what order.

## What it shows

An issuer registers a property asset on Avalanche Fuji, uploads its records (deed, parcel record, tax assessment, survey), gets an IPFS CID per file, stores the files on Filecoin, and anchors a manifest CID to the asset. Anyone can then read the pointer from Avalanche, fetch the records, re-hash them, and check that Filecoin is still proving storage. A modified deed fails. A legitimate update publishes a new version and keeps the old one verifiable.

## Where this comes from

Ava Labs and the Filecoin Foundation announced an Avalanche and Filecoin cross-chain data bridge in May 2025. It relayed a one-time storage attestation to Avalanche through a bridge and depended on a pinning service. That code is no longer maintained. This template keeps the idea and changes three things:

- Continuous proofs. Storage providers prove possession on a schedule, and the verifier reads that schedule, instead of trusting one attestation at deal time.
- A versioned manifest. Each record set is one CID with an append-only history on chain. Updates add a version. Tampering fails verification.
- No relayer in the trust path. The verifier reads Avalanche and Filecoin directly.

The full comparison, with sources, is in `docs/research/avalanche-prior-art.md`.

## Who keeps the record

The issuer stays the record of authority. For a county, that means the county still manages its registry. The chain adds an audit that anyone can run without asking the issuer, and the records and their proofs remain available if the issuer's own systems go down. Documents are public and synthetic in this example. Confidential records need encryption and key management before storage, which this template does not cover.

## Repository

- `mockup/` is the click-through of all eight screens and the identity boards. Open `mockup/index.html` in a browser. The buttons advance the flow.
- `contracts/` is the registry contract, deployed on Fuji, plus an optional ERC-721 mix-in for issuers who already have a token. See `contracts/README.md`.
- `docs/research/` holds the standards review and the prior-art review.
- `docs/build-plan.md` is the build order and the conventions.

## Networks

Avalanche Fuji (chain id 43113) and Filecoin Calibration. The contract is plain EVM and runs on any EVM chain. Synthetic data only.

## Trademarks

AVAX and Avalanche are marks of Ava Labs. This project is built on Avalanche and does not claim endorsement by or affiliation with Ava Labs. Filecoin and IPFS marks belong to their respective foundations.
