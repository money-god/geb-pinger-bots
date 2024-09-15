import { BigNumber, Contract, ethers } from 'ethers'
import { contracts, TransactionRequest } from 'mcgeb.js'
import { notifier } from '..'
import { Transactor } from '../chains/transactor'
import { TWAP_RATE__UPDATE_RESULTS_GAS, COIN_TWAP__UPDATE_RESULTS_GAS, RATE_SETTER__UPDATE_RATE_GAS } from '../utils/constants'
import { now } from '../utils/time'

export class CoinTwapAndRateSetter {
  protected twap: contracts.UniswapConsecutiveSlotsMedianRaiusd
  protected transactor: Transactor

  constructor(
    ethTwapAddress: string,
    twapRateBundlerAddress: string,
    wallet: ethers.Signer,
    protected minUpdateIntervalTwap: number,
  ) {
    this.transactor = new Transactor(wallet)
    /*
    this.twap = this.transactor.getGebContract(
      contracts.UniswapConsecutiveSlotsMedianRaiusd,
      ethTwapAddress
    )
    */
    this.twap = new Contract(ethTwapAddress, [
          'function updateResult() external', 'function lastUpdateTime() public view returns (uint256)'
        ], wallet)
    this.bundler = this.transactor.getGebContract(contracts.BasefeeOsmDeviationCallBundler, twapRateBundlerAddress)
  }

  public async ping() {
    await this.updatedTwapRate()
  }

  private async tryUpdateBundler(tx) {
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
    console.log(`TWAP_RATE update sent, transaction hash: ${txHash}`)

  }
  async updatedTwapRate(): Promise<boolean> {
    let tx: TransactionRequest

    // Check if it's too early to update
    const lastUpdatedTime = await this.twap.lastUpdateTime()
    if (now().sub(lastUpdatedTime).lt(this.minUpdateIntervalTwap)) {
      // Too early to update but still checking if there is a pending transaction
      // If there is a pending tx, continue the execution so you bump the gas price
      if (!(await this.transactor.isAnyTransactionPending())) {
        console.log('Too early to update')
        return false
      } else {
        console.log(
          'Too early to update but there is pending tx so continue execution in order to bump the gas price'
        )
      }
    }

    // Simulate call
    try {
      //tx = this.bundler.updateResult()
      tx = await new ethers.Contract(this.bundler.address, [
        'function call() external',
      ]).populateTransaction.call()

      //tx = this.twap.updateResult()
      console.log("before call")
      await this.transactor.ethCall(tx)
      console.log("after call")
    } catch (err) {
        console.log("Call err")
        console.log(err)
      if (err.startsWith('ChainlinkTWAP/wait-more')) {
        console.log('The twap cannot be updated just yet')
      } else if (err.startsWith('ChainlinkTWAP/invalid-timestamp')) {
        // We can't update because chainlink is stall, throw error only if it was stall for a long time
        
        // Fetch the latest chainlink timestamp from the chainlink aggregator
        const chainlinkAggregatorAddress: string = await new Contract(this.twap.address, [
          'function chainlinkAggregator() public view returns (address)',
        ], this.transactor.provider).chainlinkAggregator()
        const lastChainlinkUpdate: BigNumber = await new Contract(chainlinkAggregatorAddress, [
          'function latestTimestamp() public view returns (uint256)',
        ], this.transactor.provider).latestTimestamp()

        if (
          now()
            .sub(lastChainlinkUpdate)
            .gt(3600 * 36)
        ) {
          await notifier.sendError(`Chainlink aggregator stall for more than 36h`)
        }
      } else {
        await notifier.sendError(`Unknown error while simulating call: ${err}`)
      }
      return false
    }

    // Send transaction
    console.log("Sending CoinTwap Update")
    console.log(tx)
    const hash = await this.transactor.ethSend(tx, true, TWAP_RATE__UPDATE_RESULTS_GAS)
    console.log(`Twap update sent, transaction hash: ${hash}`)

    return true
  }

}
