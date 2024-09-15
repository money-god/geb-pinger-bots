pragma solidity ^0.8.13;

import "forge-std/Test.sol";

import "../src/PingerBundledDeviationCall.sol";

interface Hevm {
    function warp(uint256) external;
}   

contract MockSafeEngine {
    function coinBalance(address) external pure returns (uint256) {
        return 10;
    }
    function approveSAFEModification(address) external {
    }
}

contract MockCoinMedianizer {
    function updateResult(address) external {
    }
}

contract MockRateSetter {
    function updateRate(address) external {
    }
}

contract MockRewardsSetter {
    function updateRewards(address) external {
    }
}

contract MockBundler {
    fallback() external {
    }
}

contract PingerBundledDeviationCallTest is DSTest {
    Hevm hevm;
    PingerBundledDeviationCall callBundler;
    MockSafeEngine mockSafeEngine;
    MockBundler mockEthBundler;
    MockBundler mockwStEthBundler;
    MockBundler mockrEthBundler;
    MockBundler mockcBEthBundler;
    MockBundler mockRaiBundler;

    MockCoinMedianizer mockCoinMedianizer;
    MockRateSetter mockRateSetter;
    MockRewardsSetter mockRewardsSetter;


    function setUp() public {
        mockSafeEngine = new MockSafeEngine();
        mockEthBundler = new MockBundler();
        mockwStEthBundler = new MockBundler();
        mockrEthBundler = new MockBundler();
        mockcBEthBundler = new MockBundler();
        mockRaiBundler = new MockBundler();
        mockCoinMedianizer = new MockCoinMedianizer();
        mockRateSetter = new MockRateSetter();
        mockRewardsSetter = new MockRewardsSetter();

        callBundler = new PingerBundledDeviationCall(
            address(mockEthBundler),
            address(mockwStEthBundler),
            address(mockrEthBundler),
            address(mockcBEthBundler),
            address(mockRaiBundler),
            address(mockCoinMedianizer),
            address(mockRateSetter),
            address(mockRewardsSetter),
            address(0x92dC9b16be52De059279916c1eF810877f85F960),
            address(mockSafeEngine)
        );

        //hevm = Hevm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
        //hevm.warp(block.timestamp + 3600 * 24);
    }

    function test_eth_bundler() public {
        callBundler.updateEthBundler();

        //callBundler.withdrawPayout(address(this), SafeEngine(0xCC88a9d330da1133Df3A7bD823B95e52511A6962).coinBalance(address(callBundler)) / 1e27);
    }

    function test_coin_median_and_rate_setter() public {
        callBundler.updateCoinMedianizerAndRateSetter(address(this));
    }
}
