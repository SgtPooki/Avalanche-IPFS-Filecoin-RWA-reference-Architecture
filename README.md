# anchorline

Verifiable offchain records for tokenized real-world assets on Avalanche, with IPFS content identifiers and Filecoin storage proofs.

Status: design stage. The click-through mockup and the identity boards are in `mockup/`. Code lands next.

## What it will show

An issuer registers a property asset on Avalanche Fuji, uploads its records (deed, parcel record, tax assessment, survey), gets an IPFS CID per file, stores the files on Filecoin, and anchors a manifest CID to the asset. Anyone can then read the pointer from Avalanche, fetch the records, re-hash them, and check that Filecoin is still proving storage. A modified deed fails. A legitimate update publishes a new version and keeps the old one verifiable.

## Mockup

Open `mockup/index.html` in a browser. The buttons advance the flow. Arrow keys work. The notes drawer under the app lists the open design questions per screen.

The identity is in `mockup/branding/final-anchor-line.png`. The other boards in that folder are the candidates we picked it from.

## Networks

Avalanche Fuji and Filecoin Calibration. Synthetic data only.
