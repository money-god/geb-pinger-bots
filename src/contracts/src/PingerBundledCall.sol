pragma solidity ^0.6.7;

interface ExternallyFundedOSM {
    function updateResult() external;
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

contract PingerBundledCall {
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
    ExternallyFundedOSM public osmEth;
    ExternallyFundedOSM public osmWstEth;
    ExternallyFundedOSM public osmREth;
    ExternallyFundedOSM public osmRai;
    OracleRelayer public oracleRelayer;
    CoinMedianizer public coinMedianizer;
    RateSetter public rateSetter;
    RewardsSetter public rewardsSetter;
    CoinJoin public coinJoin;

    bytes32 constant ETH_A = 0x4554482d41000000000000000000000000000000000000000000000000000000;
    bytes32 constant ETH_B = 0x4554482d42000000000000000000000000000000000000000000000000000000;
    bytes32 constant ETH_C = 0x4554482d43000000000000000000000000000000000000000000000000000000;
    bytes32 constant WSTETH_A = 0x5753544554482d41000000000000000000000000000000000000000000000000;
    bytes32 constant WSTETH_B = 0x5753544554482d42000000000000000000000000000000000000000000000000;
    bytes32 constant RETH_A = 0x524554482d412d41000000000000000000000000000000000000000000000000;
    bytes32 constant RETH_B = 0x524554482d412d42000000000000000000000000000000000000000000000000;
    bytes32 constant RAI_A =  0x5241492d41000000000000000000000000000000000000000000000000000000;

    // --- Events ---
    event AddAuthorization(address account);
    event RemoveAuthorization(address account);
    event ModifyParameters(bytes32 parameter, address data);

    constructor(address osmEth_, address osmWstEth_, address osmREth_, address osmRai_,
                address oracleRelayer_, address coinMedianizer_, address rateSetter_,
                address rewardsSetter_, address _coinJoin, address _safeEngine, address _owner) public {

        authorizedAccounts[msg.sender] = 1;

        osmEth = ExternallyFundedOSM(osmEth_);
        osmWstEth = ExternallyFundedOSM(osmWstEth_);
        osmREth = ExternallyFundedOSM(osmREth_);
        osmRai = ExternallyFundedOSM(osmRai_);

        oracleRelayer = OracleRelayer(oracleRelayer_);
        coinMedianizer = CoinMedianizer(coinMedianizer_);
        rateSetter = RateSetter(rateSetter_);
        rewardsSetter = RewardsSetter(rewardsSetter_);
        coinJoin = CoinJoin(_coinJoin);
        SafeEngine(_safeEngine).approveSAFEModification(_coinJoin);

        owner = _owner;

        emit AddAuthorization(msg.sender);
    }

     /**
     * @notice Modify general address params
     * @param parameter The name of the parameter modified
     * @param data New value for the parameter
     */
    function modifyParameters(bytes32 parameter, address data) external isAuthorized {
        require(data != address(0), "PingerBundledCall/null-data");
        if (parameter == "osmEth") osmEth = data;
        else if (parameter == "osmWstEth") osmWstEth = data;
        else if (parameter == "osmREth") osmREth = data;
        else if (parameter == "osmRai") osmRai = data;
        else if (parameter == "oracleRelayer") oracleRelayer = data;
        else if (parameter == "coinMedianizer") coinMedianizer = data;
        else if (parameter == "rateSetter") rateSetter = data;
        else if (parameter == "rewardsSetter") rewardsSetter = data;
        else if (parameter == "coinJoin") coinJoin = data;
        else revert("PingerBundledCall/modify-unrecognized-param");
        emit ModifyParameters(parameter, data);
    }

    function updateEthOsmAndCollateralTypes() external {
        osmEth.updateResult();
        oracleRelayer.updateCollateralPrice(ETH_A);
        oracleRelayer.updateCollateralPrice(ETH_B);
        oracleRelayer.updateCollateralPrice(ETH_C);
    }

    function updateWstEthOsmCollateralTypes() external {
        osmWstEth.updateResult();
        oracleRelayer.updateCollateralPrice(WSTETH_A);
        oracleRelayer.updateCollateralPrice(WSTETH_B);
    }

    function updateREthOsmAndCollateralTypes() external {
        osmREth.updateResult();
        oracleRelayer.updateCollateralPrice(RETH_A);
        oracleRelayer.updateCollateralPrice(RETH_B);
    }

    function updateRaiOsmAndCollateralTypes() external {
        osmRai.updateResult();
        oracleRelayer.updateCollateralPrice(RAI_A);
    }

    function updateOsmsAndCollateralTypes(address[] osms, bytes32[] collateralTypes) external {
        for (uint i; i < osm.length; i++) {
            ExternallyFundedOSM(osms[i]).updateResult();
            oracleRelayer.updateCollateralPrice(collateralTypes[i]);
        }
    }

    function updateAllOsmsAndCollateralTypes() external {
        osmEth.updateResult();
        oracleRelayer.updateCollateralPrice(ETH_A);
        oracleRelayer.updateCollateralPrice(ETH_B);
        oracleRelayer.updateCollateralPrice(ETH_C);

        osmWstEth.updateResult();
        oracleRelayer.updateCollateralPrice(WSTETH_A);
        oracleRelayer.updateCollateralPrice(WSTETH_B);

        osmREth.updateResult();
        oracleRelayer.updateCollateralPrice(RETH_A);
        oracleRelayer.updateCollateralPrice(RETH_B);

        osmRai.updateResult();
        oracleRelayer.updateCollateralPrice(RAI_A);
    }

    function updateCoinMedianizer(address feeReceiver) external {
        coinMedianizer.updateResult(feeReceiver);
    }

    function updateRateSetter(address feeReceiver) external {
        rateSetter.updateRate(feeReceiver);
    }

    function updateRewardSetter(address feeReceiver) external {
        rewardSetter.updateRewards(feeReceiver);
    }

    function updateCoinMedianizerAndRateSetter(address feeReceiver) external {
        coinMedianizer.updateResult(feeReceiver);
        rateSetter.updateRate(feeReceiver);
    }

    function updateCoinMedianizerAndRewardSetter(address feeReceiver) external {
        coinMedianizer.updateResult(feeReceiver);
        rewardSetter.updateRewards(feeReceiver);
    }

    function updateCoinMedianizerRateAndRewardSetter(address feeReceiver) external {
        coinMedianizer.updateResult(feeReceiver);
        rateSetter.updateRate(feeReceiver);
        rewardSetter.updateRewards(feeReceiver);
    }

    function withdrawPayout(address to, uint256 wad) external {
        require(msg.sender == owner, "Not owner");

        coinJoin.exit(address(this), wad);
        Erc20(coinJoin.systemCoin()).transfer(to, wad);
    }

    /**
    * @notice Checks whether msg.sender can call an authed function
    **/
    modifier isAuthorized {
        require(authorizedAccounts[msg.sender] == 1, "TaxCollector/account-not-authorized");
        _;
    }


}
