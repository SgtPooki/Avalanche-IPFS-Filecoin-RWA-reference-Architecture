// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AssetRecordRegistry} from "../src/AssetRecordRegistry.sol";

contract AssetRecordRegistryTest is Test {
    AssetRecordRegistry reg;
    address issuer = address(0xA11CE);
    address other = address(0xB0B);

    function setUp() public {
        reg = new AssetRecordRegistry();
    }

    function test_registerThenPublishTwoVersions() public {
        vm.startPrank(issuer);
        reg.registerAsset("BAL-PROP-001", "bafyMeta");
        uint256 v1 = reg.setManifest("BAL-PROP-001", "bafyManifest1", "bafkPiece1", 1842);
        uint256 v2 = reg.setManifest("BAL-PROP-001", "bafyManifest2", "bafkPiece2", 1842);
        vm.stopPrank();

        assertEq(v1, 1);
        assertEq(v2, 2);
        (AssetRecordRegistry.ManifestVersion memory cur, uint256 ver) = reg.currentManifest(issuer, "BAL-PROP-001");
        assertEq(ver, 2);
        assertEq(cur.manifestCid, "bafyManifest2");
        assertEq(reg.versionAt(issuer, "BAL-PROP-001", 1).manifestCid, "bafyManifest1");
        assertEq(reg.history(issuer, "BAL-PROP-001").length, 2);
    }

    function test_setManifestRegistersLazily() public {
        vm.prank(issuer);
        reg.setManifest("BAL-PROP-002", "bafyManifest", "bafkPiece", 7);
        AssetRecordRegistry.Asset memory a = reg.getAsset(issuer, "BAL-PROP-002");
        assertEq(a.owner, issuer);
        assertEq(reg.versionCount(issuer, "BAL-PROP-002"), 1);
    }

    function test_namespacesDoNotCollide() public {
        vm.prank(issuer);
        reg.setManifest("BAL-PROP-001", "bafyA", "bafkA", 1);
        vm.prank(other);
        reg.setManifest("BAL-PROP-001", "bafyB", "bafkB", 2);
        (AssetRecordRegistry.ManifestVersion memory a,) = reg.currentManifest(issuer, "BAL-PROP-001");
        (AssetRecordRegistry.ManifestVersion memory b,) = reg.currentManifest(other, "BAL-PROP-001");
        assertEq(a.manifestCid, "bafyA");
        assertEq(b.manifestCid, "bafyB");
    }

    function test_rejectsDuplicateRegisterAndEmptyCid() public {
        vm.startPrank(issuer);
        reg.registerAsset("X", "");
        vm.expectRevert(AssetRecordRegistry.AssetExists.selector);
        reg.registerAsset("X", "");
        vm.expectRevert(AssetRecordRegistry.EmptyCid.selector);
        reg.setManifest("X", "", "", 0);
        vm.stopPrank();
    }

    function test_unknownAssetReverts() public {
        vm.expectRevert(AssetRecordRegistry.UnknownAsset.selector);
        reg.currentManifest(issuer, "nope");
    }
}
