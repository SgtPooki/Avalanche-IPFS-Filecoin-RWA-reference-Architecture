// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AssetRecordRegistry
/// @notice Anchors the offchain record set of a real-world asset to the chain.
///         Each asset is namespaced by the account that registers it, so any
///         issuer can use one deployment without colliding with another.
///         Every publish appends a version. Nothing is overwritten.
/// @dev    Plain EVM. Works on any EVM chain; deployed to Avalanche Fuji for the
///         reference demo. The record bytes never touch this contract: it stores
///         the manifest's IPFS CID plus the Filecoin storage reference a verifier
///         needs to check proofs (piece CID and data set id).
contract AssetRecordRegistry {
    struct ManifestVersion {
        string manifestCid; // IPFS CID of the manifest JSON
        string manifestPieceCid; // Filecoin piece CID holding the manifest
        uint64 dataSetId; // Filecoin PDP data set that proves the piece
        uint64 publishedAt; // block timestamp
    }

    struct Asset {
        address owner;
        string assetId;
        string metadataCid; // optional IPFS CID of asset metadata (property.json)
        bool exists;
    }

    mapping(bytes32 => Asset) private _assets;
    mapping(bytes32 => ManifestVersion[]) private _history;

    event AssetRegistered(bytes32 indexed key, address indexed owner, string assetId, string metadataCid);
    event ManifestUpdated(
        bytes32 indexed key,
        address indexed owner,
        string assetId,
        uint256 version,
        string manifestCid,
        string manifestPieceCid,
        uint64 dataSetId
    );

    error AssetExists();
    error UnknownAsset();
    error EmptyCid();

    /// @notice Deterministic key for an (owner, assetId) pair.
    function keyOf(address owner, string calldata assetId) public pure returns (bytes32) {
        return keccak256(abi.encode(owner, assetId));
    }

    /// @notice Register an asset under the caller's namespace.
    function registerAsset(string calldata assetId, string calldata metadataCid) external returns (bytes32 key) {
        key = keyOf(msg.sender, assetId);
        if (_assets[key].exists) revert AssetExists();
        _assets[key] = Asset({owner: msg.sender, assetId: assetId, metadataCid: metadataCid, exists: true});
        emit AssetRegistered(key, msg.sender, assetId, metadataCid);
    }

    /// @notice Publish a new manifest version for the caller's asset.
    ///         Registers the asset on first use so a single call can anchor.
    function setManifest(
        string calldata assetId,
        string calldata manifestCid,
        string calldata manifestPieceCid,
        uint64 dataSetId
    ) external returns (uint256 version) {
        if (bytes(manifestCid).length == 0) revert EmptyCid();
        bytes32 key = keyOf(msg.sender, assetId);
        if (!_assets[key].exists) {
            _assets[key] = Asset({owner: msg.sender, assetId: assetId, metadataCid: "", exists: true});
            emit AssetRegistered(key, msg.sender, assetId, "");
        }
        _history[key].push(
            ManifestVersion({
                manifestCid: manifestCid,
                manifestPieceCid: manifestPieceCid,
                dataSetId: dataSetId,
                publishedAt: uint64(block.timestamp)
            })
        );
        version = _history[key].length;
        emit ManifestUpdated(key, msg.sender, assetId, version, manifestCid, manifestPieceCid, dataSetId);
    }

    /// @notice Asset record for an (owner, assetId) pair.
    function getAsset(address owner, string calldata assetId) external view returns (Asset memory) {
        Asset memory a = _assets[keyOf(owner, assetId)];
        if (!a.exists) revert UnknownAsset();
        return a;
    }

    /// @notice Latest manifest version, or revert if none published.
    function currentManifest(address owner, string calldata assetId)
        external
        view
        returns (ManifestVersion memory current, uint256 version)
    {
        ManifestVersion[] storage h = _history[keyOf(owner, assetId)];
        if (h.length == 0) revert UnknownAsset();
        return (h[h.length - 1], h.length);
    }

    /// @notice Number of published versions.
    function versionCount(address owner, string calldata assetId) external view returns (uint256) {
        return _history[keyOf(owner, assetId)].length;
    }

    /// @notice A specific version, 1-based.
    function versionAt(address owner, string calldata assetId, uint256 version)
        external
        view
        returns (ManifestVersion memory)
    {
        ManifestVersion[] storage h = _history[keyOf(owner, assetId)];
        if (version == 0 || version > h.length) revert UnknownAsset();
        return h[version - 1];
    }

    /// @notice Full append-only history.
    function history(address owner, string calldata assetId) external view returns (ManifestVersion[] memory) {
        return _history[keyOf(owner, assetId)];
    }
}
