import algosdk from 'algosdk';
import {
  ALGORAND_MAINNET_CAIP2,
  ALGORAND_TESTNET_CAIP2,
  ExactAvmScheme,
  toClientAvmSigner,
} from '@x402/avm';
import { wrapFetchWithPayment, x402Client, x402HTTPClient } from '@x402/fetch';
import type { AlgorandNetwork } from '../config.js';

export function createAvmPayingClient(
  mnemonic: string,
  networkName: AlgorandNetwork,
  fetchImpl: typeof fetch = fetch,
) {
  let account: algosdk.Account;
  try {
    account = algosdk.mnemonicToSecretKey(mnemonic);
  } catch {
    throw new Error('The payment mnemonic is invalid. It must be a valid 25-word Algorand mnemonic.');
  }

  const network =
    networkName === 'testnet' ? ALGORAND_TESTNET_CAIP2 : ALGORAND_MAINNET_CAIP2;
  const signer = toClientAvmSigner(Buffer.from(account.sk).toString('base64'));
  const client = new x402Client();
  client.register(network, new ExactAvmScheme(signer));

  return {
    signer,
    network,
    fetchWithPayment: wrapFetchWithPayment(fetchImpl, client),
    httpClient: new x402HTTPClient(client),
  };
}
