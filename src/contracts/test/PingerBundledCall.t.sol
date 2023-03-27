pragma solidity ^0.8.13;

import "forge-std/Test.sol";

import "../src/PingerBundledCall.sol";

interface Hevm {
    function warp(uint256) external;
}   

contract PingerBundledCallTest is DSTest {
    Hevm hevm;
    PingerBundledCall bundler;

    function setUp() public {
        /*
            constructor(address osmEth_, address osmWstEth_, address osmREth_, address osmRai_,
                address oracleRelayer_, address coinMedianizer_, address rateSetter_,
                address rewardsSetter_, address _coinJoin, address _safeEngine) public {

               */

        bundler = new PingerBundledCall(
            address(0x92dC9b16be52De059279916c1eF810877f85F960),
            address(0x92dC9b16be52De059279916c1eF810877f85F960),
            address(0x92dC9b16be52De059279916c1eF810877f85F960),
            address(0x92dC9b16be52De059279916c1eF810877f85F960),
            address(0x92dC9b16be52De059279916c1eF810877f85F960),
            address(0x92dC9b16be52De059279916c1eF810877f85F960),
            address(0x92dC9b16be52De059279916c1eF810877f85F960),
            address(0x92dC9b16be52De059279916c1eF810877f85F960),
            address(0x92dC9b16be52De059279916c1eF810877f85F960),
            address(0x92dC9b16be52De059279916c1eF810877f85F960)
        );

        //hevm = Hevm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
        //hevm.warp(block.timestamp + 3600 * 24);
    }

    function _test_osm_and_oracle_relayer() public {
        bundler.updateEthOsmAndCollateralTypes();

        bundler.withdrawPayout(address(this), SafeEngine(0xCC88a9d330da1133Df3A7bD823B95e52511A6962).coinBalance(address(bundler)) / 1e27);
    }

    function _test_coin_median_and_rate_setter() public {
        bundler.updateCoinMedianizerAndRateSetter(address(this));
    }
}
