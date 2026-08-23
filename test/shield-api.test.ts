import algosdk from 'algosdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { createReceiptSigner } from '../src/shield/receipt.js';
import type { ResourceCallResult, ResourceClient } from '../src/shield/resource-client.js';
import type { RequestedResource, ResourceDefinition } from '../src/shield/types.js';
import { testConfig } from './config.js';

const shieldRequest = {
  requestId: 'job_123',
  resources: [
    {
      id: 'weather',
      input: { city: 'Bangalore' },
      maxPayment: 3_000,
      required: true,
    },
  ],
};

function paymentHeader(amount = '4000') {
  return Buffer.from(
    JSON.stringify({
      x402Version: 2,
      accepted: {
        scheme: 'exact',
        network: testConfig.network,
        amount,
        asset: testConfig.usdcAssetId,
        payTo: testConfig.payTo,
        maxTimeoutSeconds: 120,
        extra: {},
      },
      payload: { paymentGroup: ['signed'], paymentIndex: 0 },
    }),
  ).toString('base64url');
}

function fakeShieldHttpServer(overrides: { amount?: string; payTo?: string } = {}) {
  let settlements = 0;
  return {
    requiresPayment: () => true,
    initialize: async () => undefined,
    processHTTPRequest: async (context: { paymentHeader?: string }) => {
      if (!context.paymentHeader) {
        return {
          type: 'payment-error' as const,
          response: {
            status: 402,
            headers: { 'payment-required': 'fake-challenge' },
            body: { error: 'payment_required' },
          },
        };
      }
      return {
        type: 'payment-verified' as const,
        cancellationDispatcher: { cancel: async () => undefined },
        paymentPayload: { x402Version: 2, payload: {}, accepted: {} },
        paymentRequirements: {
          scheme: 'exact',
          network: testConfig.network,
          amount: overrides.amount ?? '4000',
          asset: testConfig.usdcAssetId,
          payTo: overrides.payTo ?? testConfig.payTo,
          maxTimeoutSeconds: 120,
          extra: {},
        },
        declaredExtensions: {},
      };
    },
    processSettlement: async () => {
      settlements += 1;
      return {
        success: true as const,
        transaction: 'UPSTREAM-TX',
        network: testConfig.network,
        payer: 'PAYER',
        headers: { 'payment-response': 'settled' },
        requirements: {},
      };
    },
    settlementCount: () => settlements,
  };
}

const resourceClient: ResourceClient = {
  execute: async (_request: RequestedResource, definition: ResourceDefinition): Promise<ResourceCallResult> => ({
    status: 200,
    transaction: `${definition.id.toUpperCase()}-TX`,
    amountAtomic: definition.priceAtomic,
    durationMs: 12,
    data: {
      city: 'Bangalore',
      temperature: 28,
      condition: 'Partly cloudy',
      humidity: 61,
      simulated: true,
      generatedAt: '2026-08-23T12:00:00.000Z',
    },
  }),
};

describe('CPMM-SHIELD API', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async input => {
        if (String(input).endsWith('/supported')) {
          return Response.json({
            kinds: [
              {
                x402Version: 2,
                scheme: 'exact',
                network: testConfig.network,
                extra: { feePayer: testConfig.payTo },
              },
            ],
            extensions: [],
            signers: { 'algorand:*': [testConfig.payTo] },
          });
        }
        throw new Error(`Unexpected fetch: ${String(input)}`);
      }),
    );
  });

  it('publishes health and trusted resource registry without payment', async () => {
    const app = createApp(testConfig);
    const [health, resources] = await Promise.all([
      app.request('/health'),
      app.request('/api/shield/resources'),
    ]);
    await expect(health.json()).resolves.toMatchObject({
      status: 'ok',
      service: 'cpmm-shield',
      challengeMode: false,
    });
    await expect(resources.json()).resolves.toMatchObject({
      resources: [
        { id: 'weather', trust: 'owned-demo', priceAtomic: 2_000 },
        { id: 'company-lookup', trust: 'owned-demo', priceAtomic: 3_000 },
        { id: 'sentiment-score', trust: 'owned-demo', priceAtomic: 2_000 },
        {
          id: 'external-algo-price',
          trust: 'external-curated',
          priceAtomic: 1_000,
          content: 'PROVIDER CONTENT',
        },
      ],
    });

    const publicBody = await createApp(testConfig).request('/api/shield/resources').then(response => response.json());
    expect(JSON.stringify(publicBody)).not.toMatch(/payTo|responseSchema|mnemonic|privateKey/i);
  });

  it('exposes only the active network external provider', async () => {
    const mainnet = { ...testConfig, networkName: 'mainnet' as const };
    const resources = await createApp(mainnet).request('/api/shield/resources');
    const body = await resources.json() as { resources: Array<{ id: string }> };

    expect(body.resources.map(resource => resource.id)).toContain('external-hash');
    expect(body.resources.map(resource => resource.id)).not.toContain('external-algo-price');
  });

  it('rejects malformed and untrusted jobs before generating a payment challenge', async () => {
    const app = createApp(testConfig);
    const malformed = await app.request('/api/shield/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{bad',
    });
    expect(malformed.status).toBe(400);
    expect(malformed.headers.get('payment-required')).toBeNull();

    const untrusted = await app.request('/api/shield/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...shieldRequest,
        resources: [{ ...shieldRequest.resources[0], id: 'attacker-api' }],
      }),
    });
    expect(untrusted.status).toBe(400);
    expect(untrusted.headers.get('payment-required')).toBeNull();
    await expect(untrusted.json()).resolves.toMatchObject({ error: 'resource_not_allowed' });
  });

  it('rejects invalid provider input before generating a payment challenge', async () => {
    const response = await createApp(testConfig).request('/api/shield/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...shieldRequest,
        resources: [{ ...shieldRequest.resources[0], input: { city: 'Bangalore', url: 'https://evil.test' } }],
      }),
    });
    expect(response.status).toBe(400);
    expect(response.headers.get('payment-required')).toBeNull();
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid_resource_input' });
  });

  it.each([
    ['testnet', 'external-hash'],
    ['mainnet', 'external-algo-price'],
  ] as const)('rejects the %s cross-network provider before a payment challenge', async (networkName, id) => {
    const response = await createApp({ ...testConfig, networkName }).request('/api/shield/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requestId: `job_cross_${networkName}`,
        resources: [{ id, input: {}, maxPayment: 1_000, required: true }],
      }),
    });

    expect(response.status).toBe(400);
    expect(response.headers.get('payment-required')).toBeNull();
    await expect(response.json()).resolves.toMatchObject({ error: 'resource_not_allowed' });
  });

  it('rejects legacy client-controlled URL and schema fields', async () => {
    const response = await createApp(testConfig).request('/api/shield/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...shieldRequest,
        resources: [{
          ...shieldRequest.resources[0],
          url: 'https://attacker.example/pay',
          expectedSchema: { type: 'object' },
        }],
      }),
    });
    expect(response.status).toBe(400);
    expect(response.headers.get('payment-required')).toBeNull();
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid_request' });
  });

  it('returns an official x402 challenge with the computed dynamic price', async () => {
    const response = await createApp(testConfig).request('/api/shield/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(shieldRequest),
    });
    expect(response.status).toBe(402);
    const encoded = response.headers.get('payment-required');
    expect(encoded).toBeTruthy();
    const challenge = JSON.parse(Buffer.from(encoded!, 'base64url').toString('utf8')) as {
      accepts: Array<{ amount: string }>;
    };
    expect(challenge.accepts[0]?.amount).toBe('4000');
    await expect(response.json()).resolves.toMatchObject({
      error: 'payment_required',
      quote: { jobId: 'job_123', quotedPriceAtomic: 4_000 },
    });
  });

  it('settles upstream before orchestration and returns a signed cached job', async () => {
    const server = fakeShieldHttpServer();
    const app = createApp(testConfig, {
      shieldHttpServer: server,
      resourceClient,
      receiptSigner: createReceiptSigner(algosdk.generateAccount()),
      bindingSecret: 'test-binding-secret-with-enough-entropy',
    });
    const unpaid = await app.request('/api/shield/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(shieldRequest),
    });
    expect(unpaid.status).toBe(402);

    const paid = await app.request('/api/shield/execute', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'payment-signature': paymentHeader(),
      },
      body: JSON.stringify(shieldRequest),
    });
    expect(paid.status).toBe(200);
    expect(paid.headers.get('payment-response')).toBe('settled');
    await expect(paid.json()).resolves.toMatchObject({
      jobId: 'job_123',
      status: 'COMPLETED',
      settlementTxnId: 'UPSTREAM-TX',
    });
    expect(server.settlementCount()).toBe(1);

    const cached = await app.request('/api/shield/jobs/job_123');
    expect(cached.status).toBe(200);
    await expect(cached.json()).resolves.toMatchObject({ jobId: 'job_123', status: 'COMPLETED' });
  });

  it('rejects a settled payment replayed against a different job', async () => {
    const server = fakeShieldHttpServer();
    const app = createApp(testConfig, {
      shieldHttpServer: server,
      resourceClient,
      receiptSigner: createReceiptSigner(algosdk.generateAccount()),
      bindingSecret: 'test-binding-secret-with-enough-entropy',
    });
    const first = await app.request('/api/shield/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'payment-signature': paymentHeader() },
      body: JSON.stringify(shieldRequest),
    });
    expect(first.status).toBe(200);

    const replay = await app.request('/api/shield/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'payment-signature': paymentHeader() },
      body: JSON.stringify({ ...shieldRequest, requestId: 'job_replay' }),
    });
    expect(replay.status).toBe(409);
    await expect(replay.json()).resolves.toMatchObject({ error: 'payment_replay' });
    expect(server.settlementCount()).toBe(1);
  });

  it.each([
    ['wrong amount', { amount: '3999' }],
    ['wrong recipient', { payTo: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' }],
  ])('rejects a verified payment with %s before settlement', async (_label, overrides) => {
    const server = fakeShieldHttpServer(overrides);
    const app = createApp(testConfig, {
      shieldHttpServer: server,
      resourceClient,
      receiptSigner: createReceiptSigner(algosdk.generateAccount()),
      bindingSecret: 'test-binding-secret-with-enough-entropy',
    });
    const response = await app.request('/api/shield/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'payment-signature': paymentHeader() },
      body: JSON.stringify(shieldRequest),
    });
    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toMatchObject({ error: 'payment_resource_mismatch' });
    expect(server.settlementCount()).toBe(0);
  });
});
