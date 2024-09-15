pragma solidity ^0.8.13;
//SPDX-License-Identifier: UNLICENSED

interface BasefeeOSMDeviationCallBundler {
    function call() external;
}

interface OracleRelayer {
    function updateCollateralPrice(bytes32 collateralType) external;
}

interface CoinMedianizer {
    function updateResult(address feeReceiver) external;
}

interface RateSetter {
    function updateRate(address feeReceiver) external;
}

interface RewardsSetter {
    function updateRewards(address feeReceiver) external;
}

interface CoinJoin {
    function exit(address to, uint256 wad) external;
    function systemCoin() external returns (address);
}

interface SafeEngine {
    function coinBalance(address user) external returns (uint256);
    function approveSAFEModification(address) external;
}

interface Erc20 {
    function balanceOf(address user) external returns (uint256);
    function transfer(address to, uint256 wad) external;
}

contract PingerBundledDeviationCall {
    // --- Auth ---
    mapping (address => uint256) public authorizedAccounts;

    /**
     * @notice Add auth to an account
     * @param account Account to add auth to
     */
    function addAuthorization(address account) external isAuthorized {
        authorizedAccounts[account] = 1;
        emit AddAuthorization(account);
    }

    /**
     * @notice Remove auth from an account
     * @param account Account to remove auth from
     */
    function removeAuthorization(address account) external isAuthorized {
        authorizedAccounts[account] = 0;
        emit RemoveAuthorization(account);
    }

    address owner;
    BasefeeOSMDeviationCallBundler public ethBundler;
    BasefeeOSMDeviationCallBundler public wstEthBundler;
    BasefeeOSMDeviationCallBundler public rEthBundler;
    BasefeeOSMDeviationCallBundler public raiBundler;
    BasefeeOSMDeviationCallBundler public cBEthBundler;
    CoinMedianizer public coinMedianizer;
    RateSetter public rateSetter;
    RewardsSetter public rewardsSetter;
    CoinJoin public coinJoin;

    bytes32 constant ETH_A = 0x4554482d41000000000000000000000000000000000000000000000000000000;
    bytes32 constant ETH_B = 0x4554482d42000000000000000000000000000000000000000000000000000000;
    bytes32 constant ETH_C = 0x4554482d43000000000000000000000000000000000000000000000000000000;
    bytes32 constant WSTETH_A = 0x5753544554482d41000000000000000000000000000000000000000000000000;
    bytes32 constant WSTETH_B = 0x5753544554482d42000000000000000000000000000000000000000000000000;
    bytes32 constant RETH_A = 0x524554482d410000000000000000000000000000000000000000000000000000;
    bytes32 constant RETH_B = 0x524554482d420000000000000000000000000000000000000000000000000000;
    bytes32 constant RAI_A = 0x5241492d41000000000000000000000000000000000000000000000000000000;
    bytes32 constant CBETH_A = 0x43424554482d4100000000000000000000000000000000000000000000000000;
    bytes32 constant CBETH_B = 0x43424554482d4200000000000000000000000000000000000000000000000000;

    // --- Events ---
    event AddAuthorization(address account);
    event RemoveAuthorization(address account);
    event ModifyParameters(bytes32 parameter, address data);

    constructor(address ethBundler_, address wstEthBundler_, address rEthBundler_, address raiBundler_, address cBEthBundler_,
                address coinMedianizer_, address rateSetter_,
                address rewardsSetter_, address _coinJoin, address _safeEngine) {

        authorizedAccounts[msg.sender] = 1;

        ethBundler = BasefeeOSMDeviationCallBundler(ethBundler_);
        wstEthBundler = BasefeeOSMDeviationCallBundler(wstEthBundler_);
        rEthBundler = BasefeeOSMDeviationCallBundler(rEthBundler_);
        raiBundler = BasefeeOSMDeviationCallBundler(raiBundler_);
        cBEthBundler = BasefeeOSMDeviationCallBundler(cBEthBundler_);

        coinMedianizer = CoinMedianizer(coinMedianizer_);
        rateSetter = RateSetter(rateSetter_);
        rewardsSetter = RewardsSetter(rewardsSetter_);
        coinJoin = CoinJoin(_coinJoin);
        SafeEngine(_safeEngine).approveSAFEModification(_coinJoin);

        owner = msg.sender;
        emit AddAuthorization(msg.sender);
    }

     /**
     * @notice Modify general address params
     * @param parameter The name of the parameter modified
     * @param data New value for the parameter
     */
    function modifyParameters(bytes32 parameter, address data) external isAuthorized {
        require(data != address(0), "PingerBundledDeviationCall/null-data");
        if (parameter == "ethBundler") ethBundler = BasefeeOSMDeviationCallBundler(data);
        else if (parameter == "wstEthBundler") wstEthBundler = BasefeeOSMDeviationCallBundler(data);
        else if (parameter == "rEthBundler") rEthBundler = BasefeeOSMDeviationCallBundler(data);
        else if (parameter == "raiBundler") raiBundler = BasefeeOSMDeviationCallBundler(data);
        else if (parameter == "cBEthBundler") cBEthBundler = BasefeeOSMDeviationCallBundler(data);
        else if (parameter == "coinMedianizer") coinMedianizer = CoinMedianizer(data);
        else if (parameter == "rateSetter") rateSetter = RateSetter(data);
        else if (parameter == "rewardsSetter") rewardsSetter = RewardsSetter(data);
        else if (parameter == "coinJoin") coinJoin = CoinJoin(data);
        else revert("PingerBundledDeviationCall/modify-unrecognized-param");
        emit ModifyParameters(parameter, data);
    }

    function updateEthBundler() external {
        ethBundler.call();
    }

    function updateWstEthBundler() external {
        wstEthBundler.call();
    }

    function updateREthBundler() external {
        rEthBundler.call();
    }

    function updateRaiBundler() external {
        raiBundler.call();
    }

    function updateCBEthBundler() external {
        cBEthBundler.call();
    }

    function updateBundlers(address[] calldata bundlers) external {
        for (uint i; i < bundlers.length; i++) {
            BasefeeOSMDeviationCallBundler(bundlers[i]).call();
        }
    }

    function updateAllBundlers() external {
        ethBundler.call();
        wstEthBundler.call();
        rEthBundler.call();
        cBEthBundler.call();
        raiBundler.call();
    }

    function updateCoinMedianizer(address feeReceiver) external {
        coinMedianizer.updateResult(feeReceiver);
    }

    function updateRateSetter(address feeReceiver) external {
        rateSetter.updateRate(feeReceiver);
    }

    function updateRewardSetter(address feeReceiver) external {
        rewardsSetter.updateRewards(feeReceiver);
    }

    function updateCoinMedianizerAndRateSetter(address feeReceiver) external {
        coinMedianizer.updateResult(feeReceiver);
        rateSetter.updateRate(feeReceiver);
    }

    function updateCoinMedianizerAndRewardSetter(address feeReceiver) external {
        coinMedianizer.updateResult(feeReceiver);
        rewardsSetter.updateRewards(feeReceiver);
    }

    function updateCoinMedianizerRateAndRewardSetter(address feeReceiver) external {
        coinMedianizer.updateResult(feeReceiver);
        rateSetter.updateRate(feeReceiver);
        rewardsSetter.updateRewards(feeReceiver);
    }

    function withdrawPayout(address to, uint256 wad) external {
        require(msg.sender == owner, "PingerBundledDeviationCall/not-owner");

        coinJoin.exit(address(this), wad);
        Erc20(coinJoin.systemCoin()).transfer(to, wad);
    }

    /**
    * @notice Checks whether msg.sender can call an authed function
    **/
    modifier isAuthorized {
        require(authorizedAccounts[msg.sender] == 1, "PingerBundledDeviationCall/account-not-authorized");
        _;
    }


}
