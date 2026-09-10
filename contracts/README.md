# Contracts

One contract, `AssetRecordRegistry`. It stores, per asset, the IPFS CID of the current manifest plus the Filecoin reference a verifier needs (piece CID and data set id), and an append-only version history. Record bytes never touch the chain.

Assets are namespaced by the account that publishes them, so every fork can use the deployed address below without colliding with anyone else. You do not need to deploy anything to run the demo.

## Deployed

Avalanche Fuji, chain id 43113: `0x7fdfdb7F166A3dEE947A5533e20B8E5Ce8c80863`. See `deployments.json`.

The contract is plain EVM. It runs unchanged on any EVM chain. Fuji is the partner testnet for this example.

## Interface

- `registerAsset(assetId, metadataCid)` registers an asset under the caller. Optional, because `setManifest` registers on first use.
- `setManifest(assetId, manifestCid, manifestPieceCid, dataSetId)` appends a version and emits `ManifestUpdated`.
- `currentManifest(owner, assetId)` returns the latest version and its number.
- `versionAt(owner, assetId, n)`, `versionCount`, and `history` read older versions.
- `keyOf(owner, assetId)` is the storage key, `keccak256(abi.encode(owner, assetId))`.

## Build and test

```
forge build
forge test
```

## Deploy your own

```
forge script script/Deploy.s.sol --rpc-url fuji --broadcast --private-key $PRIVATE_KEY
```
