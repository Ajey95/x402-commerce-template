import { describe, expect, it } from 'vitest';
import { getTrustedExternalProviders } from '../src/shield/trusted-providers.js';

describe('network-aware curated providers', () => {
  it('returns only the TestNet ALGO price provider with exact schemas', () => {
    const providers = getTrustedExternalProviders('testnet');

    expect(providers).toEqual([
      expect.objectContaining({
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
        responseSchema: expect.objectContaining({
          required: [
            'symbol',
            'price',
            'data_timestamp',
            'request_id',
            'response_hash',
            'signature',
            'provider',
            'sla_hash',
            'served_at',
            'paid_via',
          ],
          properties: expect.objectContaining({
            provider: {
              type: 'string',
              maxLength: 58,
              const: 'T7X54PQA7EXDPIRKNV3PHQFGXILNG7H7LWHFM4PNWDN2AJOFIHLOUX2Q74',
            },
            paid_via: {
              type: 'object',
              required: ['protocol', 'network', 'asset', 'asset_id', 'amount', 'facilitator'],
              properties: {
                protocol: { type: 'string', maxLength: 8, const: 'x402' },
                network: {
                  type: 'string',
                  maxLength: 80,
                  const: 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
                },
                asset: { type: 'string', maxLength: 8, const: 'USDC' },
                asset_id: { type: 'number', const: 10_458_941 },
                amount: { type: 'number', const: 0.001 },
                facilitator: {
                  type: 'string',
                  maxLength: 100,
                  const: 'https://facilitator.goplausible.xyz',
                },
              },
              additionalProperties: false,
            },
          }),
          additionalProperties: false,
        }),
        trust: 'external-curated',
      }),
    ]);
    expect(JSON.stringify(providers)).not.toContain('external-hash');
  });

  it('returns only the MainNet hashing provider with exact schemas', () => {
    const providers = getTrustedExternalProviders('mainnet');

    expect(providers).toEqual([
      expect.objectContaining({
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
            algo: { type: 'string', maxLength: 8, enum: ['sha256', 'sha512', 'sha1', 'md5'] },
          },
          additionalProperties: false,
        },
        responseSchema: expect.objectContaining({
          required: ['algo', 'hex', 'base64'],
          additionalProperties: false,
        }),
        trust: 'external-curated',
      }),
    ]);
    expect(JSON.stringify(providers)).not.toContain('external-algo-price');
  });

  it('returns fresh provider definitions on every call', () => {
    const first = getTrustedExternalProviders('testnet');
    const second = getTrustedExternalProviders('testnet');

    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
    expect(first[0]?.tags).not.toBe(second[0]?.tags);
    expect(first[0]?.responseSchema).not.toBe(second[0]?.responseSchema);
  });
});
