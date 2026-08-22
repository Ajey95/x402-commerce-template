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
      url: `${testConfig.shield.baseUrl}/api/resources/weather`,
      maxPayment: 3_000,
      required: true,
      expectedSchema: { type: 'object', required: ['temperature', 'condition'] },
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
    await expect(health.json()).resolves.toMatchObject({ status: 'ok', service: 'cpmm-shield' });
    await expect(resources.json()).resolves.toMatchObject({
      resources: [
        { id: 'weather', priceAtomic: 2_000 },
        { id: 'company-lookup', priceAtomic: 3_000 },
        { id: 'sentiment-score', priceAtomic: 2_000 },
      ],
    });
  });

  it('rejects malformed and disallowed jobs before generating a payment challenge', async () => {
    const app = createApp(testConfig);
    const malformed = await app.request('/api/shield/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{bad',
    });
    expect(malformed.status).toBe(400);

    const disallowed = await app.request('/api/shield/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...shieldRequest,
        resources: [{ ...shieldRequest.resources[0], url: 'http://127.0.0.1/admin' }],
      }),
    });
    expect(disallowed.status).toBe(400);
    await expect(disallowed.json()).resolves.toMatchObject({ error: 'resource_url_not_allowed' });
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
