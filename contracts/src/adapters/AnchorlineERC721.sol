// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AssetRecordRegistry} from "../AssetRecordRegistry.sol";

/// @title AnchorlineERC721
/// @notice Mix-in for an issuer that already has an ERC-721. The token contract
///         becomes the registry owner for its tokens and the decimal token id is
///         the asset id, so the deployed registry is reused unchanged.
///         `tokenURI` can resolve to the current manifest as an `ipfs://` URI
///         and every publish emits the ERC-4906 `MetadataUpdate` event, which is
///         what marketplaces and indexers listen to for metadata refreshes.
/// @dev    Inherit alongside your ERC-721, call `_publishRecords` from an
///         issuer-only function, and return `_manifestURI(tokenId)` from
///         `tokenURI`. Add `0x49064906` to `supportsInterface` for ERC-4906.
abstract contract AnchorlineERC721 {
    /// @dev ERC-4906
    event MetadataUpdate(uint256 _tokenId);

    bytes4 internal constant ERC4906_INTERFACE_ID = 0x49064906;

    AssetRecordRegistry public immutable registry;

    constructor(AssetRecordRegistry registry_) {
        registry = registry_;
    }

    /// @notice Anchor a new record set version for `tokenId`.
    function _publishRecords(
        uint256 tokenId,
        string memory manifestCid,
        string memory manifestPieceCid,
        uint64 dataSetId
    ) internal returns (uint256 version) {
        version = registry.setManifest(_assetId(tokenId), manifestCid, manifestPieceCid, dataSetId);
        emit MetadataUpdate(tokenId);
    }

    /// @notice `ipfs://<manifestCid>` for the current version of `tokenId`.
    function _manifestURI(uint256 tokenId) internal view returns (string memory) {
        (AssetRecordRegistry.ManifestVersion memory v,) = registry.currentManifest(address(this), _assetId(tokenId));
        return string.concat("ipfs://", v.manifestCid);
    }

    /// @notice Registry asset id for a token: its decimal token id.
    function _assetId(uint256 tokenId) internal pure returns (string memory) {
        if (tokenId == 0) return "0";
        uint256 n = tokenId;
        uint256 len;
        while (n != 0) {
            len++;
            n /= 10;
        }
        bytes memory buf = new bytes(len);
        while (tokenId != 0) {
            buf[--len] = bytes1(uint8(48 + (tokenId % 10)));
            tokenId /= 10;
        }
        return string(buf);
    }
}
