import { adminContracts, TransactionRequest } from '@money-god/geb-admin'
import { ethers } from 'ethers'
import { notifier } from '..'
import { Transactor } from '../chains/transactor'
import { SETTER_GAS_500K } from '../utils/constants'
import { now } from '../utils/time'

export class DebtAuctionInitialParameterSetter {
  protected adjuster: adminContracts.DebtAuctionInitialParameterSetter
  protected transactor: Transactor

  constructor(
    setterAddress: string,
    wallet: ethers.Signer,
    protected rewardReceiver: string,
    private minUpdateInterval
  ) {
    this.transactor = new Transactor(wallet)
    this.adjuster = this.transactor.getGebContract(
      adminContracts.DebtAuctionInitialParameterSetter,
      setterAddress
    )
  }

  public async ping() {
    // Check if it's too early to update
    const lastUpdatedTime = await this.adjuster.lastUpdateTime()
    if (now().sub(lastUpdatedTime).lt(this.minUpdateInterval)) {
      // To early to update but still check if there a pending transaction.
      // If yes continue the execution that will bump the gas price.
      if (!(await this.transactor.isAnyTransactionPending())) {
        console.log('To early to update')
        return
      }
    }

    // Send the caller reward to specified address or send the reward to the pinger bot
    let rewardReceiver =
      !this.rewardReceiver || this.rewardReceiver === ''
        ? await this.transactor.getWalletAddress()
        : this.rewardReceiver

    // Simulate call
    let tx: TransactionRequest
    try {
      tx = this.adjuster.setDebtAuctionInitialParameters(rewardReceiver)
      await this.transactor.ethCall(tx)
    } catch (err) {
      if (err.startsWith('DebtAuctionInitialParameterSetter/wait-more')) {
        console.log('DebtAuctionInitialParameterSetter, wait more')
      } else {
        await notifier.sendError(`Unknown error while simulating call: ${err}`)
      }
      return
    }

    // Send transaction
    const hash = await this.transactor.ethSend(
      tx,
      true,
      SETTER_GAS_500K
    )
    console.log(`Update sent, transaction hash: ${hash}`)
  }
}
