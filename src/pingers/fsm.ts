import { ethers } from 'ethers'
import { contracts, TransactionRequest, utils } from 'mcgeb.js'
import { notifier } from '..'
import { Transactor } from '../chains/transactor'
import {
  APPROXIMATED_BLOCK_INTERVAL,
  COLLATERAL_FSM__UPDATE_RESULTS_GAS,
  ORACLE_RELAYER__UPDATE_COLLATERAL_PRICE_GAS,
} from '../utils/constants'
import { now } from '../utils/time'

export class CollateralFsmPinger {
  private fsmEth: contracts.Osm
  private fsmWstEth: contracts.Osm
  private fsmREth: contracts.Osm
  private fsmRai: contracts.Osm
  private oracleRelayer: contracts.OracleRelayer
  private transactor: Transactor

  constructor(
    ethOsmAddress: string,
    wstethOsmAddress: string,
    rethOsmAddress: string,
    raiOsmAddress: string,
    oracleRelayerAddress: string,
    private collateralType: string,
    wallet: ethers.Signer,
    private minUpdateInterval: number,
    private maxUpdateNoUpdateInterval: number,
    private minUpdateIntervalDeviation: number,
    private callBundlerAddress?: string
  ) {
    this.transactor = new Transactor(wallet)
    this.fsmEth = this.transactor.getGebContract(contracts.Osm, ethOsmAddress)
    this.fsmWstEth = this.transactor.getGebContract(contracts.Osm, wstethOsmAddress)
    this.fsmREth = this.transactor.getGebContract(contracts.Osm, rethOsmAddress)
    this.fsmRai = this.transactor.getGebContract(contracts.Osm, raiOsmAddress)
    this.oracleRelayer = this.transactor.getGebContract(
      contracts.OracleRelayer,
      oracleRelayerAddress
    )
  }

  public async ping() {
    let didUpdateFsm = false

    if (await this.shouldUpdateFsm()) {
      // Simulate call
      let txFsm: TransactionRequest
      try {
        // Use the call bundler if available
        if (this.callBundlerAddress) {
          txFsm = await new ethers.Contract(this.callBundlerAddress, [
            'function updateAllOsmsAndCollateralTypes() external',
          ]).populateTransaction.updateAllOsmsAndCollateralTypes()
        } else {
          txFsm = this.fsmEth.updateResult()
        }
        await this.transactor.ethCall(txFsm)
      } catch (err) {
        if (
          typeof err == 'string' &&
          (err.startsWith('OSM/not-passed') ||
            err.startsWith('DSM/not-passed') ||
            err.startsWith('ExternallyFundedOSM/not-passed'))
        ) {
          console.log('FSM not yet ready to be updated')
        } else {
          await notifier.sendError(`Unknown error while simulating call: ${err}`)
        }
        return
      }

      // Send FSM transaction
      let fsmHash = await this.transactor.ethSend(txFsm, true, COLLATERAL_FSM__UPDATE_RESULTS_GAS * 4)
      didUpdateFsm = true
      console.log(`FSM update sent, transaction hash: ${fsmHash}`)
    } else {
      console.log('To early to update the FSM')
    }

    // == Oracle Relayer ==

    let shouldUpdateOracleRelayer = await this.shouldUpdateOracleRelayer()
    if (this.callBundlerAddress) {
      // If we're using the call bundler, no need to update the FSM unless we're late
      shouldUpdateOracleRelayer = shouldUpdateOracleRelayer && !didUpdateFsm
    } else {
      // Without call bundler we need to update the oracle relayer after a call to the fsm
      shouldUpdateOracleRelayer = shouldUpdateOracleRelayer || didUpdateFsm
    }

    // Update the OracleRelayer if we just updated a FSM OR if the relayer is stale
    if (shouldUpdateOracleRelayer) {
      let txRelayer = this.oracleRelayer.updateCollateralPrice(this.collateralType)
      // Send the OracleRelayer transaction
      let relayerHash = await await this.transactor.ethSend(
        txRelayer,
        !didUpdateFsm,
        ORACLE_RELAYER__UPDATE_COLLATERAL_PRICE_GAS
      )
      console.log(`OracleRelayer update sent, transaction hash: ${relayerHash}`)
    } else {
      console.log('Too early to update the OracleRelayer')
    }
  }

  // Evaluate wether we should update the FSM or not
  private async shouldUpdateFsm() {
    if (await this.transactor.isAnyTransactionPending()) {
      // A transaction from a previous run is pending and therefore needs a gas bump so we should update
      return true
    }
    const fsmEthLastUpdatedTime = await this.fsmEth.lastUpdateTime()
    const timeSinceLastUpdate = now().sub(fsmEthLastUpdatedTime)

    if (timeSinceLastUpdate.gte(this.maxUpdateNoUpdateInterval)) {
      // The fsm wasn't update in a very long time, more than the upper limit, update it now.
      return true
    } else if (timeSinceLastUpdate.lt(this.minUpdateInterval)) {
      // The fsm was update too recently, don't update.
      return false
    } else {
      // we're between minUpdateInterval and maxUpdateNoUpdateInterval update only if any of the price deviations
      // are large (more than minUpdateIntervalDeviation %).
      // ETH
      const pendingFsmEthPrice = (await this.fsmEth.getNextResultWithValidity())[0] // RAY
      const ethPriceSourceAddress = await this.fsmEth.priceSource()
      const ethPriceRelayContract = this.transactor.getGebContract(
        contracts.ChainlinkRelayer,
        ethPriceSourceAddress
      )
      const nextPendingFsmEthPrice = (await ethPriceRelayContract.getResultWithValidity())[0] // RAY
      const ethPriceDeviation = nextPendingFsmEthPrice
        .sub(pendingFsmEthPrice)
        .abs()
        .mul(utils.RAY)
        .div(pendingFsmEthPrice)

      // WSTETH
      const pendingFsmWstEthPrice = (await this.fsmWstEth.getNextResultWithValidity())[0] // RAY
      const wstethPriceSourceAddress = await this.fsmWstEth.priceSource()
      const wstethPriceRelayContract = this.transactor.getGebContract(
        contracts.ChainlinkRelayer,
        wstethPriceSourceAddress
      )
      const nextPendingFsmWstEthPrice = (await wstethPriceRelayContract.getResultWithValidity())[0] // RAY
      const wstethPriceDeviation = nextPendingFsmWstEthPrice
        .sub(pendingFsmWstEthPrice)
        .abs()
        .mul(utils.RAY)
        .div(pendingFsmWstEthPrice)

      // RETH
      const pendingFsmRethPrice = (await this.fsmReth.getNextResultWithValidity())[0] // RAY
      const rethPriceSourceAddress = await this.fsmReth.priceSource()
      const rethPriceRelayContract = this.transactor.getGebContract(
        contracts.ChainlinkRelayer,
        rethPriceSourceAddress
      )
      const nextPendingFsmRethPrice = (await rethPriceRelayContract.getResultWithValidity())[0] // RAY
      const rethPriceDeviation = nextPendingFsmRethPrice
        .sub(pendingFsmRethPrice)
        .abs()
        .mul(utils.RAY)
        .div(pendingFsmRethPrice)

      // RAI
      const pendingFsmRaiPrice = (await this.fsmRai.getNextResultWithValidity())[0] // RAY
      const raiPriceSourceAddress = await this.fsmRai.priceSource()
      const raiPriceRelayContract = this.transactor.getGebContract(
        contracts.ChainlinkRelayer,
        raiPriceSourceAddress
      )
      const nextPendingFsmRaiPrice = (await raiPriceRelayContract.getResultWithValidity())[0] // RAY
      const raiPriceDeviation = nextPendingFsmRaiPrice
        .sub(pendingFsmRaiPrice)
        .abs()
        .mul(utils.RAY)
        .div(pendingFsmRaiPrice)

      // If the price deviation is larger than the threshold..
      if (utils.rayToFixed(ethPriceDeviation).toUnsafeFloat() >= this.minUpdateIntervalDeviation) {
        return true
      } else if (utils.rayToFixed(wstethPriceDeviation).toUnsafeFloat() >= this.minUpdateIntervalDeviation) { 
        return true
      } else if (utils.rayToFixed(rethPriceDeviation).toUnsafeFloat() >= this.minUpdateIntervalDeviation) { 
        return true
      } else if (utils.rayToFixed(raiPriceDeviation).toUnsafeFloat() >= this.minUpdateIntervalDeviation) { 
        return true
      } else {
        return false
      }
    }
  }

  // Check if the OracleRelayer needs to be updated by looking at the last update time
  private async shouldUpdateOracleRelayer() {
    const currentBlock = await this.transactor.getBlockNumber()

    // Get the latest OracleRelayer update events
    // Assume a 12sec block interval
    // Update if it has been more than the max OSM update interval + 30min
    // This is meant as a backup if somehow the piped update after the OSM one fails
    const scanFromBlock =
      currentBlock - Math.floor((this.maxUpdateNoUpdateInterval + 30) / APPROXIMATED_BLOCK_INTERVAL)
    const events = await this.transactor.getContractEvents(
      'event UpdateCollateralPrice(bytes32 indexed collateralType, uint256 priceFeedValue, uint256 safetyPrice, uint256 liquidationPrice)',
      this.oracleRelayer.address,
      scanFromBlock,
      currentBlock
    )
    const lastEvents = await events
      // Remove events related to other collateral types
      .filter((x) => ((x.args as ethers.utils.Result).collateralType as string) === utils.ETH_A)
      // Sort events by descending time
      .sort((a, b) => b.blockNumber - a.blockNumber)

    // Update if there is no recent event or if the latest one is more than minUpdateInterval old
    if (lastEvents.length === 0) {
      return true
    } else {
      const lastUpdateTimeOracleRelayer = (await lastEvents[0].getBlock()).timestamp
      return now().sub(lastUpdateTimeOracleRelayer).gte(this.minUpdateInterval)
    }
  }
}
