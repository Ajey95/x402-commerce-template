import algosdk from 'algosdk';
import type { Context } from 'hono';
import type { RuntimeConfig } from '../config.js';
import { createAvmPayingClient } from '../x402/client.js';

export function createDemoPurchaseHandler(config: RuntimeConfig) {
  return async (c: Context) => {
    if (!config.demoMode) {
      return c.json(
        {
          error: 'demo_disabled',
          message: 'Set DEMO_MODE=true to enable the local TestNet purchase agent.',
        },
        403,
      );
    }
    if (config.networkName !== 'testnet') {
      return c.json(
        { error: 'demo_testnet_only', message: 'The one-click demo is disabled on MainNet.' },
        403,
      );
    }
    if (!config.demoMnemonic) {
      return c.json(
        {
          error: 'missing_demo_wallet',
          message: 'CLIENT_MNEMONIC is required for the local TestNet demo agent.',
        },
        503,
      );
    }

    const body: { address?: string } = await c.req
      .json<{ address?: string }>()
      .catch(() => ({}));
    const address = body.address?.trim();
    if (!address || !algosdk.isValidAddress(address)) {
      return c.json(
        { error: 'invalid_address', message: 'Enter a valid Algorand address.' },
        400,
      );
    }

    const payer = createAvmPayingClient(config.demoMnemonic, config.networkName);
    if (payer.signer.address === config.payTo) {
      return c.json(
        {
          error: 'self_payment',
          message: 'The demo payer and PAY_TO_ADDRESS must be different accounts.',
        },
        400,
      );
    }

    const resourceUrl = `${new URL(c.req.url).origin}/api/wallet/${address}`;
    const challenge = await fetch(resourceUrl);
    if (challenge.status !== 402) {
      return c.json(
        {
          error: 'challenge_failed',
          message: `Expected HTTP 402 from CPMM-SHIELD, received ${challenge.status}.`,
        },
        502,
      );
    }

    const response = await payer.fetchWithPayment(resourceUrl);
    if (!response.ok) {
      return c.json(
        {
          error: 'payment_failed',
          message: `The paid request returned HTTP ${response.status}.`,
        },
        402,
      );
    }

    const settlement = payer.httpClient.getPaymentSettleResponse(name => response.headers.get(name));
    if (!settlement.success) {
      return c.json(
        { error: 'settlement_unconfirmed', message: 'No successful settlement receipt was returned.' },
        502,
      );
    }

    return c.json({
      status: 'settled',
      payment: {
        price: config.price,
        network: config.network,
        asset: config.usdcAssetId,
        payer: payer.signer.address,
        payTo: config.payTo,
        transaction: settlement.transaction,
        explorer: `https://testnet.explorer.perawallet.app/tx/${settlement.transaction}`,
      },
      report: await response.json(),
    });
  };
}
