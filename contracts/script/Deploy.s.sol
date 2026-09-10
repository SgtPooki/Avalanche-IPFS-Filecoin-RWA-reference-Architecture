// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AssetRecordRegistry} from "../src/AssetRecordRegistry.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        AssetRecordRegistry reg = new AssetRecordRegistry();
        vm.stopBroadcast();
        console.log("AssetRecordRegistry deployed at", address(reg));
    }
}
