import { describe, expect, it } from 'vitest';
import { buildProviderRequest } from '../src/shield/provider-request.js';
import { createResourceRegistry } from '../src/shield/registry.js';
import { getTrustedExternalProviders } from '../src/shield/trusted-providers.js';

const registry = createResourceRegistry('https://shield.example');

describe('provider request mapping', () => {
  it('maps weather input to a GET query string', () => {
    const definition = registry.get('weather')!;
    const built = buildProviderRequest({
      id: 'weather',
      input: { city: 'New York' },
      maxPayment: 3_000,
      required: true,
    }, definition, 5_000);
    expect(built.url).toBe('https://shield.example/api/resources/weather?city=New+York');
    expect(built.init.method).toBe('GET');
    expect(built.init.body).toBeUndefined();
    expect(built.init.redirect).toBe('manual');
  });

  it('maps sentiment input to an exact POST body', () => {
    const definition = registry.get('sentiment-score')!;
    const built = buildProviderRequest({
      id: 'sentiment-score',
      input: { text: 'Secure and fast.' },
      maxPayment: 3_000,
      required: true,
    }, definition, 5_000);
    expect(built.url).toBe('https://shield.example/api/resources/sentiment-score');
    expect(built.init.method).toBe('POST');
    expect(built.init.body).toBe(JSON.stringify({ text: 'Secure and fast.' }));
  });

  it('maps the TestNet external price feed to an exact GET without query or body', () => {
    const definition = getTrustedExternalProviders('testnet')[0]!;
    const built = buildProviderRequest({
      id: 'external-algo-price',
      input: {},
      maxPayment: 1_000,
      required: true,
    }, definition, 5_000);

    expect(built.url).toBe('https://recourse-api-production.up.railway.app/feed/compliant');
    expect(built.init.method).toBe('GET');
    expect(built.init.body).toBeUndefined();
  });

  it('maps the MainNet external hash provider to the exact POST body', () => {
    const definition = getTrustedExternalProviders('mainnet')[0]!;
    const built = buildProviderRequest({
      id: 'external-hash',
      input: { text: 'CPMM-SHIELD', algo: 'sha256' },
      maxPayment: 1_000,
      required: true,
    }, definition, 5_000);

    expect(built.url).toBe('https://agent402.tools/api/hash');
    expect(built.init.method).toBe('POST');
    expect(built.init.body).toBe(JSON.stringify({ text: 'CPMM-SHIELD', algo: 'sha256' }));
  });
});
