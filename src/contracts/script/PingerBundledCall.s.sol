pragma solidity ^0.8.13;
import "../src/PingerBundledCall.sol";
import "forge-std/Script.sol";

contract GoerliDeploy is Script {
    function setUp() public {
    }

    function run() public {
        address osmEth = address(0xa4B396bbF114fE81fEd339E329f137945D98677f);
        address osmWstEth = address(0xdB614931954152C8918d657d358a99A1D936F170);
        address osmREth = address(0x869BAFC80BCCe38772d63566E551e7ddefE649cD);
        address osmRai = address(0xd96c6276D4ED4A89d5BD7Bc77e225e4711570833);
        address oracleRelayer = address(0xda4b192cB436c5429acc7799b68b307f66976a85);
        address coinMedianizer = address(1);
        address rateSetter = address(0x871c8F54122BDFa68ca439afc2033f68F6AbE23d);
        address rewardsSetter = address(1);
        address coinJoin = address(0x6e027fcF681e9DB7eb41677Ebb82ea569F54C69C);
        address safeEngine = address(0x3f7C6ae368102C80E451CddF1D243964CE77BaFD);
        vm.startBroadcast();
        new PingerBundledCall(osmEth, osmWstEth, osmREth, osmRai, oracleRelayer, coinMedianizer,
                                                        rateSetter, rewardsSetter, coinJoin, safeEngine);
        vm.stopBroadcast();
    }
}

