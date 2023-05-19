pragma solidity ^0.8.13;
import "../src/PingerBundledCall.sol";
import "forge-std/Script.sol";

contract GoerliDeploy is Script {
    function setUp() public {
    }

    function run() public {
        address osmEth = address(0xaabF54Da611D8F8A8989b5A413e4bD1ACE058E79);
        address osmWstEth = address(0xCb320D54d99250fD8D463B0Fea6785e44e78ce86);
        address osmREth = address(0x7b7c098db146B204BD058d975C0F8cA7f7aABB55);
        address osmCBEth = address(0x5bB796c1DCccbe9Ed7d77853Bb7B47ADb2651Ff8);
        address osmRai = address(0x84383072692E56Ce9697fa76296512498baa1fdA);
        address oracleRelayer = address(0x6aa9D2f366beaAEc40c3409E5926e831Ea42DC82);
        address coinMedianizer = address(1);
        address rateSetter = address(0x8486459a8A03fbBfa9D9590aD9Dc4e239425E969);
        address rewardsSetter = address(1);
        address coinJoin = address(0x3498503E58b65F3585C87780Aff380e061d55d23);
        address safeEngine = address(0x3AD2F30266B35F775D58Aecde3fbB7ea8b83bF2b);
        vm.startBroadcast();
        new PingerBundledCall(osmEth, osmWstEth, osmREth, osmRai, osmCBEth, oracleRelayer, coinMedianizer,
                                                        rateSetter, rewardsSetter, coinJoin, safeEngine);
        vm.stopBroadcast();
    }
}

