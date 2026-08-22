import { ExactAvmScheme } from '@x402/avm/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';
import type { ResourceServerExtension } from '@x402/core/types';
import type { RoutesConfig } from '@x402/core/server';
import { paymentMiddleware, x402HTTPResourceServer, x402ResourceServer } from '@x402/hono';
import { bazaarResourceServerExtension, declareDiscoveryExtension } from '@x402-avm/extensions';
import type { RuntimeConfig } from '../config.js';
import type { QuoteService } from '../shield/quote.js';
import type { ResourceRegistry } from '../shield/registry.js';

export const WALLET_DESCRIPTION =
  'Returns ALGO balance, ASA holdings, USDC balance, account status, and basic activity information for an Algorand address.';

function createServer(config: RuntimeConfig) {
  const facilitator = new HTTPFacilitatorClient({ url: config.facilitatorUrl });
  const server = new x402ResourceServer(facilitator);
  server.register(config.network, new ExactAvmScheme());
  server.registerExtension(bazaarResourceServerExtension as unknown as ResourceServerExtension);
  return server;
}

function paymentOption(config: RuntimeConfig, price: string) {
  return {
    scheme: 'exact' as const,
    price,
    network: config.network,
    payTo: config.payTo,
    extra: {
      asset: config.usdcAssetId,
      ...(config.challengeMode ? { tag: 'x402-global-challenge' } : {}),
    },
  };
}

export function createX402Middleware(config: RuntimeConfig, registry?: ResourceRegistry) {
  const server = createServer(config);

  const discovery = declareDiscoveryExtension({
    input: {
      address: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
    },
    inputSchema: {
      properties: {
        address: {
          type: 'string',
          description: 'A valid 58-character Algorand account address',
          minLength: 58,
          maxLength: 58,
        },
      },
      required: ['address'],
    },
    output: {
      example: {
        address: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
        algoBalance: 127.35,
        assetCount: 9,
        usdcBalance: 24.5,
        status: 'active',
        summary: 'Active paid API holding 9 assets.',
        createdAssets: 0,
        appsLocalStateCount: 2,
        minimumBalance: 0.3,
      },
    },
  });

  const routes: RoutesConfig = {
      'GET /api/wallet/:address': {
        accepts: [paymentOption(config, config.price)],
        description: WALLET_DESCRIPTION,
        mimeType: 'application/json',
        extensions: discovery,
      },
    };
  for (const definition of registry?.values() ?? []) {
    routes[`${definition.method} ${definition.path}`] = {
      accepts: [paymentOption(config, `$${(definition.priceAtomic / 1_000_000).toFixed(6)}`)],
      description: `${definition.id} demo data. SIMULATED CONTENT / REAL TESTNET PAYMENT.`,
      mimeType: 'application/json',
      serviceName: 'cpmm-shield downstream demo resources',
      tags: ['cpmm-shield', 'algorand', 'x402', 'simulated-content'],
    };
  }
  return paymentMiddleware(routes, server);
}

export function createShieldHttpServer(config: RuntimeConfig, quotes: QuoteService) {
  const discovery = declareDiscoveryExtension({
    input: {
      requestId: 'job_123',
      resources: [
        {
          id: 'weather',
          url: `${config.shield.baseUrl}/api/resources/weather`,
          maxPayment: 3000,
          expectedSchema: { type: 'object', required: ['temperature', 'condition'] },
        },
      ],
    },
    inputSchema: {
      properties: {
        requestId: { type: 'string', description: 'Unique idempotency key for this shield job' },
        resources: { type: 'array', description: 'Allowlisted paid resources to orchestrate' },
      },
      required: ['requestId', 'resources'],
    },
    output: {
      example: {
        jobId: 'job_123',
        status: 'COMPLETED',
        summary: { requested: 1, completed: 1, failed: 0, rejections: 0 },
        payments: {
          upfront: '0.004000',
          downstream: '0.002000',
          serviceFee: '0.001000',
          remaining: '0.001000',
        },
      },
    },
  });
  const routes: RoutesConfig = {
    'POST /api/shield/execute': {
      accepts: [
        {
          ...paymentOption(config, config.price),
          price: context => quotes.dynamicPrice(context),
        },
      ],
      resource: `${config.shield.baseUrl}/api/shield/execute`,
      description:
        'CPMM-SHIELD accepts one x402 payment, pays allowlisted resources from an isolated treasury, validates responses, and returns a signed aggregate receipt.',
      mimeType: 'application/json',
      serviceName: 'cpmm-shield',
      tags: ['cpmm-shield', 'agentic-commerce', 'algorand', 'x402'],
      unpaidResponseBody: context => quotes.unpaidBody(context),
      extensions: discovery,
    },
  };
  return new x402HTTPResourceServer(createServer(config), routes);
}
