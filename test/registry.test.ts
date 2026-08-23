import { describe, expect, it } from 'vitest';
import { createResourceRegistry } from '../src/shield/registry.js';
import type { ResourceDefinition } from '../src/shield/types.js';

function external(origin: string): ResourceDefinition {
  return {
    id: 'external-research',
    name: 'External Research',
    origin,
    method: 'POST',
    path: '/api/research',
    priceAtomic: 2_500,
    maxPriceAtomic: 3_000,
    inputSchema: {
      type: 'object',
      required: ['query'],
      properties: { query: { type: 'string', maxLength: 120 } },
      additionalProperties: false,
    },
    responseSchema: {
      type: 'object',
      required: ['answer'],
      properties: { answer: { type: 'string', maxLength: 1_000 } },
      additionalProperties: false,
    },
    trust: 'external-curated',
    description: 'Curated external x402 research provider.',
    tags: ['research', 'x402'],
  };
}

describe('trusted external provider registry', () => {
  it('accepts an explicitly curated HTTPS provider', () => {
    const registry = createResourceRegistry('http://localhost:3000', [external('https://provider.example')]);
    expect(registry.get('external-research')).toMatchObject({
      trust: 'external-curated',
      origin: 'https://provider.example',
      maxPriceAtomic: 3_000,
    });
  });

  it.each([
    'http://provider.example',
    'https://localhost',
    'https://127.0.0.1',
    'https://10.0.0.8',
    'https://172.16.1.5',
    'https://192.168.1.7',
  ])('rejects unsafe curated origin %s', origin => {
    expect(() => createResourceRegistry('http://localhost:3000', [external(origin)])).toThrow();
  });

  it('rejects a curated provider whose declared price exceeds its own ceiling', () => {
    expect(() => createResourceRegistry('http://localhost:3000', [{
      ...external('https://provider.example'),
      priceAtomic: 3_001,
    }])).toThrow(/maxPriceAtomic/);
  });
});
