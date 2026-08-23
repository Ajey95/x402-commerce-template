import { describe, expect, it } from 'vitest';
import { buildProviderRequest } from '../src/shield/provider-request.js';
import { createResourceRegistry } from '../src/shield/registry.js';

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
});
