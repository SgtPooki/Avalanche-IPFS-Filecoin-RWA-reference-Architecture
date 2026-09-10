// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AssetRecordRegistry} from "../src/AssetRecordRegistry.sol";
import {AnchorlineERC721} from "../src/adapters/AnchorlineERC721.sol";

/// Minimal stand-in for an issuer's ERC-721. Only the pieces the adapter touches.
contract DemoDeedToken is AnchorlineERC721 {
    address public issuer;

    constructor(AssetRecordRegistry r) AnchorlineERC721(r) {
        issuer = msg.sender;
    }

    function publish(uint256 tokenId, string calldata cid, string calldata pieceCid, uint64 dataSetId)
        external
        returns (uint256)
    {
        require(msg.sender == issuer, "not issuer");
        return _publishRecords(tokenId, cid, pieceCid, dataSetId);
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        return _manifestURI(tokenId);
    }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == ERC4906_INTERFACE_ID;
    }
}

contract AnchorlineERC721Test is Test {
    AssetRecordRegistry reg;
    DemoDeedToken token;

    event MetadataUpdate(uint256 _tokenId);

    function setUp() public {
        reg = new AssetRecordRegistry();
        token = new DemoDeedToken(reg);
    }

    function test_tokenURIResolvesToCurrentManifest() public {
        vm.expectEmit(true, true, true, true);
        emit MetadataUpdate(42);
        uint256 v = token.publish(42, "bafyManifestA", "bafkPieceA", 1842);
        assertEq(v, 1);
        assertEq(token.tokenURI(42), "ipfs://bafyManifestA");

        token.publish(42, "bafyManifestB", "bafkPieceB", 1842);
        assertEq(token.tokenURI(42), "ipfs://bafyManifestB");
        assertEq(reg.versionCount(address(token), "42"), 2);
    }

    function test_registryEntryIsOwnedByTokenContract() public {
        token.publish(7, "bafyX", "bafkX", 1);
        AssetRecordRegistry.Asset memory a = reg.getAsset(address(token), "7");
        assertEq(a.owner, address(token));
        assertTrue(token.supportsInterface(0x49064906));
    }

    function test_tokenIdZeroAndLargeIds() public {
        token.publish(0, "bafyZero", "bafkZero", 1);
        token.publish(1234567890123, "bafyBig", "bafkBig", 1);
        assertEq(token.tokenURI(0), "ipfs://bafyZero");
        assertEq(reg.versionCount(address(token), "1234567890123"), 1);
    }
}
