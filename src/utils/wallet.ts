import { ethers } from 'ethers'
import { PingerAccount } from '../chains/accounts'

export const getPrivateKeyFromHdWallet = (passphrase: string, index: number) => {
  const hdWallet = ethers.utils.HDNode.fromMnemonic(passphrase)
  // Default path m/44'/60'/0'/0/0
  const path = ethers.utils.defaultPath.slice(0, -1) + index.toString()
  return hdWallet.derivePath(path)
}

export const getAddress = (passphrase: string, account: PingerAccount) => {
  const hdNode = getPrivateKeyFromHdWallet(passphrase, account)
  return ethers.utils.computeAddress(hdNode.privateKey)
}

export const getWallet = (ethRpc: string, passphrase: string, account: PingerAccount) => {
  const provider = getProvider(ethRpc)
  return new ethers.Wallet(getPrivateKeyFromHdWallet(passphrase, account).privateKey, provider)
}

export const getProvider = (ethRpc: string) => {
  // Setup a redundant provider with a quorum of 1
  const urls = ethRpc.split(',')
  const provider = new ethers.providers.FallbackProvider(
    urls.map((x) => ({
      provider: new ethers.providers.JsonRpcProvider({
        url: x,
        timeout: 1000,
        throttleLimit: 4,
        throttleCallback: async (a, u) => {
          console.log(`RPC throttled, call attempt ${a} url: ${u}`)
          return true
        },
      }),
      priority: 1,
      stallTimeout: 1000,
    })),
    1
  )

  return provider
}
