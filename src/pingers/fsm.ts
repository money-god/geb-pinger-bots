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
  private fsmCBEth: contracts.Osm
  private fsmOEth: contracts.Osm
  private oracleRelayer: contracts.OracleRelayer
  private transactor: Transactor

  constructor(
    ethOsmAddress: string,
    wstethOsmAddress: string,
    rethOsmAddress: string,
    raiOsmAddress: string,
    cbethOsmAddress: string,
    oethOsmAddress: string,
    ethBundlerAddress: string,
    wstethBundlerAddress: string,
    rethBundlerAddress: string,
    cbethBundlerAddress: string,
    oethBundlerAddress: string,
    raiBundlerAddress: string,
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
    this.fsmCBEth = this.transactor.getGebContract(contracts.Osm, cbethOsmAddress)
    this.fsmOEth = this.transactor.getGebContract(contracts.Osm, oethOsmAddress)
    this.ethBundler = this.transactor.getGebContract(contracts.BasefeeOsmDeviationCallBundler, ethBundlerAddress)
    this.wstethBundler = this.transactor.getGebContract(contracts.BasefeeOsmDeviationCallBundler, wstethBundlerAddress)
    this.rethBundler = this.transactor.getGebContract(contracts.BasefeeOsmDeviationCallBundler, rethBundlerAddress)
    this.cbethBundler = this.transactor.getGebContract(contracts.BasefeeOsmDeviationCallBundler, cbethBundlerAddress)
    this.oethBundler = this.transactor.getGebContract(contracts.BasefeeOsmDeviationCallBundler, oethBundlerAddress)
    this.raiBundler = this.transactor.getGebContract(contracts.BasefeeOsmDeviationCallBundler, raiBundlerAddress)

    this.oracleRelayer = this.transactor.getGebContract(
      contracts.OracleRelayer,
      oracleRelayerAddress
    )
  }
     
  private async tryUpdateBundler(tx, collateral) {
    try {
        await this.transactor.ethCall(tx)
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
    let txHash = await this.transactor.ethSend(tx, false, COLLATERAL_FSM__UPDATE_RESULTS_GAS*4)
    console.log(`${collateral} FSM update sent, transaction hash: ${txHash}`)

  }

  public async ping() {
    var tx;

    if (await this.shouldCallOSMBundler('eth')) {
      console.log("Updating eth")
      tx = await new ethers.Contract(this.ethBundler.address, [
        'function call() external',
      ]).populateTransaction.call()
      this.tryUpdateBundler(tx, 'eth')
    }
    if (await this.shouldCallOSMBundler('wsteth')) {
      console.log("Updating wsteth")
      tx = await new ethers.Contract(this.wstethBundler.address, [
        'function call() external',
      ]).populateTransaction.call()
      this.tryUpdateBundler(tx, 'wsteth')
    }
    if (await this.shouldCallOSMBundler('reth')) {
      console.log("Updating reth")
      tx = await new ethers.Contract(this.rethBundler.address, [
        'function call() external',
      ]).populateTransaction.call()
      this.tryUpdateBundler(tx, 'reth')
    }
    if (await this.shouldCallOSMBundler('cbeth')) {
      console.log("Updating cbeth")
      tx = await new ethers.Contract(this.cbethBundler.address, [
        'function call() external',
      ]).populateTransaction.call()
      this.tryUpdateBundler(tx, 'cbeth')
    }
    if (await this.shouldCallOSMBundler('oeth')) {
      console.log("Updating oeth")
      tx = await new ethers.Contract(this.oethBundler.address, [
        'function call() external',
      ]).populateTransaction.call()
      this.tryUpdateBundler(tx, 'oeth')
    }
    if (await this.shouldCallOSMBundler('rai')) {
      console.log("Updating rai")
      tx = await new ethers.Contract(this.raiBundler.address, [
        'function call() external',
      ]).populateTransaction.call()
      this.tryUpdateBundler(tx, 'rai')
    }

  }

  /*
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
      const pendingFsmRethPrice = (await this.fsmREth.getNextResultWithValidity())[0] // RAY
      const rethPriceSourceAddress = await this.fsmREth.priceSource()
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

      // CBETH
      const pendingFsmCBethPrice = (await this.fsmCBEth.getNextResultWithValidity())[0] // RAY
      const cbethPriceSourceAddress = await this.fsmCBEth.priceSource()
      const cbethPriceRelayContract = this.transactor.getGebContract(
        contracts.ChainlinkRelayer,
        cbethPriceSourceAddress
      )
      const nextPendingFsmCBethPrice = (await cbethPriceRelayContract.getResultWithValidity())[0] // RAY
      const cbethPriceDeviation = nextPendingFsmCBethPrice
        .sub(pendingFsmCBethPrice)
        .abs()
        .mul(utils.RAY)
        .div(pendingFsmCBethPrice)

      // If the price deviation is larger than the threshold..
      if (utils.rayToFixed(ethPriceDeviation).toUnsafeFloat() >= this.minUpdateIntervalDeviation) {
        return true
      } else if (utils.rayToFixed(wstethPriceDeviation).toUnsafeFloat() >= this.minUpdateIntervalDeviation) { 
        return true
      } else if (utils.rayToFixed(rethPriceDeviation).toUnsafeFloat() >= this.minUpdateIntervalDeviation) { 
        return true
      } else if (utils.rayToFixed(raiPriceDeviation).toUnsafeFloat() >= this.minUpdateIntervalDeviation) { 
        return true
      } else if (utils.rayToFixed(cbethPriceDeviation).toUnsafeFloat() >= this.minUpdateIntervalDeviation) { 
        return true
      } else {
        return false
      }
    }
  }
  */
  // Evaluate wether we should update the FSM or not
  private async shouldCallOSMBundler(collateral: string) {
    var fsm;
    var bundler;
    if (collateral == 'eth') {
        fsm = this.fsmEth
        bundler = this.ethBundler
    } else if (collateral == 'wsteth') {
        fsm = this.fsmWstEth
        bundler = this.wstethBundler
    } else if (collateral == 'reth') {
        fsm = this.fsmREth
        bundler = this.rethBundler
    } else if (collateral == 'cbeth') {
        fsm = this.fsmCBEth
        bundler = this.cbethBundler
    } else if (collateral == 'oeth') {
        fsm = this.fsmOEth
        bundler = this.oethBundler
    } else if (collateral == 'rai') {
        fsm = this.fsmRai
        bundler = this.raiBundler
    }

    const fsmLastUpdatedTime = await fsm.lastUpdateTime()
    console.log(`${collateral} fsm ${fsm.address} fsmLastUpdatedTime: ${fsmLastUpdatedTime}`)
    const timeSinceLastUpdate = now().sub(fsmLastUpdatedTime)

    if (timeSinceLastUpdate.lt(this.minUpdateInterval)) {
      // The fsm was update too recently, don't update.
      console.log(`${collateral} too soon to update. Time since update: ${timeSinceLastUpdate}`)
      return false
    } else {
      // update only if any of the price deviations
      // are large (more than bundler.acceptedDeviation %).
      // current FSM Price
      const currentFsmPrice = (await fsm.getResultWithValidity())[0] // RAY
      // next FSM Price
      const nextFsmPrice = (await fsm.getNextResultWithValidity())[0] // RAY
      const priceSourceAddress = await fsm.priceSource()
      const priceRelayContract = this.transactor.getGebContract(
        contracts.ChainlinkRelayer,
        priceSourceAddress
      )
      // market price
      const marketFsmPrice = (await priceRelayContract.getResultWithValidity())[0] // RAY
      const marketPriceDeviation = marketFsmPrice
        .sub(currentFsmPrice)
        .abs()
        .mul(utils.RAY)
        .div(currentFsmPrice)
      const nextPriceDeviation = nextFsmPrice
        .sub(currentFsmPrice)
        .abs()
        .mul(utils.RAY)
        .div(currentFsmPrice)
       
      console.log(`${collateral} currentFsmPrice: ${currentFsmPrice}, nextFsmPrice: ${nextFsmPrice}, market: ${marketFsmPrice}`)
      // If the price deviation is larger than the rewards threshold..
      if (utils.rayToFixed(marketPriceDeviation).toUnsafeFloat() >= (await bundler.acceptedDeviation()).toNumber()/1000) {
        console.log(`${collateral} deviation is large enough. next price deviation: ${(utils.rayToFixed(nextPriceDeviation).toUnsafeFloat()).toFixed(2)} market deviation: ${(utils.rayToFixed(marketPriceDeviation).toUnsafeFloat()).toFixed(2)}`)
        return true
      } else if (utils.rayToFixed(nextPriceDeviation).toUnsafeFloat() >= (await bundler.acceptedDeviation()).toNumber()/1000) {
        console.log(`${collateral} deviation is large enough. next price deviation: ${(utils.rayToFixed(nextPriceDeviation).toUnsafeFloat()).toFixed(2)} market deviation: ${(utils.rayToFixed(marketPriceDeviation).toUnsafeFloat()).toFixed(2)}`)
        return true
      } else {
        console.log(`${collateral} deviation not large enough. next price deviation: ${(utils.rayToFixed(nextPriceDeviation).toUnsafeFloat()).toFixed(2)} market deviation: ${(utils.rayToFixed(marketPriceDeviation).toUnsafeFloat()).toFixed(2)}`)
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
