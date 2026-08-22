import type { Context } from 'hono';
import type { RuntimeConfig } from '../config.js';
import { parseExecuteShieldRequest } from '../shield/request.js';
import { createAvmPayingClient } from '../x402/client.js';
import { requestShieldJob } from '../../client/shield-client.js';

export function createShieldDemoHandler(config: RuntimeConfig) {
  return async (c: Context) => {
    if (!config.demoMode) {
      return c.json({ error: 'demo_disabled', message: 'Set DEMO_MODE=true to enable the TestNet demo payer.' }, 403);
    }
    if (config.networkName !== 'testnet') {
      return c.json({ error: 'demo_testnet_only', message: 'The browser demo payer is TestNet-only.' }, 403);
    }
    if (!config.demoMnemonic) {
      return c.json({ error: 'missing_demo_wallet', message: 'CLIENT_MNEMONIC is required for the demo payer.' }, 503);
    }
    if (!config.treasuryMnemonic) {
      return c.json({ error: 'missing_treasury', message: 'TREASURY_MNEMONIC is required before accepting a shield payment.' }, 503);
    }
    try {
      const request = parseExecuteShieldRequest(await c.req.json());
      const payer = createAvmPayingClient(config.demoMnemonic, config.networkName);
      if (payer.signer.address === config.payTo) {
        return c.json({ error: 'self_payment', message: 'CLIENT_MNEMONIC and PAY_TO_ADDRESS must use different accounts.' }, 400);
      }
      return c.json(
        await requestShieldJob(config.shield.baseUrl, request, {
          fetchWithPayment: payer.fetchWithPayment,
          readSettlement: response => payer.httpClient.getPaymentSettleResponse(name => response.headers.get(name)),
        }),
      );
    } catch (error) {
      return c.json(
        { error: 'demo_failed', message: error instanceof Error ? error.message : 'The demo payer failed.' },
        502,
      );
    }
  };
}
