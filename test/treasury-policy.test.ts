import { describe, expect, it } from 'vitest';
import { createDownstreamPaymentPolicy } from '../src/shield/treasury.js';
import { createResourceRegistry } from '../src/shield/registry.js';

const payTo = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ';
const config = {
  network: 'algorand:test-network-id' as `${string}:${string}`,
  usdcAssetId: '10458941',
  payTo,
};
const weather = createResourceRegistry('https://shield.example').get('weather')!;

function requirement(overrides: Record<string, unknown> = {}) {
  return {
    scheme: 'exact',
    network: config.network,
    amount: '2000',
    asset: config.usdcAssetId,
    payTo,
    maxTimeoutSeconds: 120,
    extra: {},
    ...overrides,
  } as never;
}

describe('downstream pre-sign payment policy', () => {
  it('accepts only the exact trusted owned-resource requirement', () => {
    const policy = createDownstreamPaymentPolicy(config, weather);
    expect(policy(2, [requirement()])).toHaveLength(1);
  });

  it.each([
    ['network', { network: 'algorand:other' }],
    ['asset', { asset: '99999999' }],
    ['amount', { amount: '2001' }],
    ['recipient', { payTo: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' }],
    ['scheme', { scheme: 'not-exact' }],
  ])('filters a requirement with the wrong %s before signing', (_label, overrides) => {
    const policy = createDownstreamPaymentPolicy(config, weather);
    expect(policy(2, [requirement(overrides)])).toEqual([]);
  });

  it('pins an explicitly curated external recipient when configured', () => {
    const externalPayTo = 'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
    const external = {
      ...weather,
      id: 'external-weather',
      origin: 'https://provider.example',
      trust: 'external-curated' as const,
      payTo: externalPayTo,
    };
    const policy = createDownstreamPaymentPolicy(config, external);
    expect(policy(2, [requirement({ payTo: externalPayTo })])).toHaveLength(1);
    expect(policy(2, [requirement({ payTo })])).toEqual([]);
  });
});
