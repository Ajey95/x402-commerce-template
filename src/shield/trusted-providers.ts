import type { ResourceDefinition } from './types.js';
import type { AlgorandNetwork } from '../config.js';

/**
 * Explicitly curated external x402 providers.
 *
 * Keep this list empty until a provider has been independently reviewed for:
 * - HTTPS origin/path/method
 * - Algorand/x402 compatibility and expected price
 * - exact request and response schemas
 * - trustworthy use case and operational ownership
 *
 * Bazaar discovery is not authorization. Never populate these definitions automatically from discovery output.
 */
export function getTrustedExternalProviders(networkName: AlgorandNetwork): ResourceDefinition[] {
  if (networkName === 'testnet') {
    return [{
      id: 'external-algo-price',
      name: 'External ALGO Price Feed',
      origin: 'https://recourse-api-production.up.railway.app',
      method: 'GET',
      path: '/feed/compliant',
      priceAtomic: 1_000,
      maxPriceAtomic: 1_000,
      payTo: 'T7X54PQA7EXDPIRKNV3PHQFGXILNG7H7LWHFM4PNWDN2AJOFIHLOUX2Q74',
      inputSchema: {
        type: 'object',
        required: [],
        properties: {},
        additionalProperties: false,
      },
      responseSchema: {
        type: 'object',
        required: ['symbol', 'price', 'data_timestamp', 'request_id', 'response_hash', 'signature'],
        properties: {
          symbol: { type: 'string', maxLength: 24 },
          price: { type: 'number' },
          data_timestamp: { type: 'number' },
          request_id: { type: 'string', maxLength: 128 },
          response_hash: { type: 'string', maxLength: 128 },
          signature: { type: 'string', maxLength: 256 },
        },
        additionalProperties: false,
      },
      trust: 'external-curated',
      description: 'Independently hosted signed ALGO/USD price feed.',
      tags: ['external-provider', 'price-feed', 'algorand', 'x402', 'testnet'],
    }];
  }

  return [{
    id: 'external-hash',
    name: 'External Deterministic Hash',
    origin: 'https://agent402.tools',
    method: 'POST',
    path: '/api/hash',
    priceAtomic: 1_000,
    maxPriceAtomic: 1_000,
    payTo: 'C7IIHG7SPLPZ5H7ZT6HW3UV2OQMQQE6Y2HBNGZXSLRJULE42BEE2OY2XIE',
    inputSchema: {
      type: 'object',
      required: ['text', 'algo'],
      properties: {
        text: { type: 'string', maxLength: 5_000 },
        algo: { type: 'string', maxLength: 8 },
      },
      additionalProperties: false,
    },
    responseSchema: {
      type: 'object',
      required: ['algo', 'hex', 'base64'],
      properties: {
        algo: { type: 'string', maxLength: 8 },
        hex: { type: 'string', maxLength: 256 },
        base64: { type: 'string', maxLength: 256 },
      },
      additionalProperties: false,
    },
    trust: 'external-curated',
    description: 'Independently hosted deterministic hashing provider.',
    tags: ['external-provider', 'hashing', 'algorand', 'x402', 'mainnet'],
  }];
}
