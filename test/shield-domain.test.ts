import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { AuditLog } from '../src/shield/audit.js';
import { InMemoryJobStore } from '../src/shield/jobs.js';
import { evaluatePolicy } from '../src/shield/policy.js';
import { createResourceRegistry } from '../src/shield/registry.js';
import { getTrustedExternalProviders } from '../src/shield/trusted-providers.js';
import { parseExecuteShieldRequest } from '../src/shield/request.js';
import type { ExecuteShieldRequest, ResourceDefinition, ShieldConfig } from '../src/shield/types.js';

const shieldConfig: ShieldConfig = {
  maxJobSpendAtomic: 20_000,
  maxResourcePaymentAtomic: 10_000,
  maxResources: 3,
  requestTimeoutMs: 5_000,
  maxResponseBytes: 64_000,
  quoteExpirySeconds: 120,
  serviceFeeAtomic: 1_000,
  demoMode: false,
  baseUrl: 'https://shield.example',
};

function request(overrides: Partial<ExecuteShieldRequest> = {}): ExecuteShieldRequest {
  return {
    requestId: 'job_123',
    resources: [
      {
        id: 'weather',
        input: { city: 'Bangalore' },
        maxPayment: 3_000,
        required: true,
      },
    ],
    ...overrides,
  };
}

describe('shield request boundary', () => {
  it('parses trusted resource ids with bounded provider input only', () => {
    expect(parseExecuteShieldRequest(request())).toEqual(request());
  });

  it.each(['url', 'expectedSchema'])('rejects legacy client-controlled %s fields', field => {
    const resource = {
      ...request().resources[0]!,
      [field]: field === 'url' ? 'https://attacker.example/pay' : { type: 'object' },
    };
    expect(() => parseExecuteShieldRequest({ requestId: 'job_123', resources: [resource] }))
      .toThrow(/unrecognized|invalid_request/i);
  });
});

describe('shield resource registry and spending policy', () => {
  it('loads bounded shield defaults and atomic USDC service fee', () => {
    const config = loadConfig({
      PAY_TO_ADDRESS: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
      API_BASE_URL: 'https://shield.example/',
      PRICE_USDC: '$0.001',
    });
    expect(config.shield).toMatchObject({
      maxJobSpendAtomic: 20_000,
      maxResourcePaymentAtomic: 10_000,
      maxResources: 3,
      requestTimeoutMs: 8_000,
      quoteExpirySeconds: 120,
      serviceFeeAtomic: 1_000,
      baseUrl: 'https://shield.example',
    });
  });

  it('rejects invalid shield numeric limits during startup', () => {
    expect(() =>
      loadConfig({
        PAY_TO_ADDRESS: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
        SHIELD_MAX_RESOURCES: '0',
      }),
    ).toThrow(/SHIELD_MAX_RESOURCES/);
  });

  it('accepts a trusted resource within atomic-unit limits', () => {
    const registry = createResourceRegistry(shieldConfig.baseUrl);
    expect(evaluatePolicy(request(), shieldConfig, registry)).toMatchObject({
      ok: true,
      totalMaxPaymentAtomic: 3_000,
      quotedPriceAtomic: 4_000,
    });
  });

  it('rejects unknown providers before payment', () => {
    const registry = createResourceRegistry(shieldConfig.baseUrl);
    const result = evaluatePolicy(
      request({ resources: [{ ...request().resources[0]!, id: 'evil-provider' }] }),
      shieldConfig,
      registry,
    );
    expect(result).toMatchObject({ ok: false, code: 'resource_not_allowed' });
  });

  it('rejects invalid provider input before payment', () => {
    const registry = createResourceRegistry(shieldConfig.baseUrl);
    expect(evaluatePolicy(
      request({ resources: [{ ...request().resources[0]!, input: { city: 'Bangalore', unexpected: true } }] }),
      shieldConfig,
      registry,
    )).toMatchObject({ ok: false, code: 'invalid_resource_input' });
    expect(evaluatePolicy(
      request({ resources: [{ ...request().resources[0]!, input: { city: '' } }] }),
      shieldConfig,
      registry,
    )).toMatchObject({ ok: false, code: 'invalid_resource_input' });
  });

  it('accepts explicitly curated external providers without making them owned routes', () => {
    const external: ResourceDefinition = {
      id: 'external-research',
      name: 'External Research',
      origin: 'https://provider.example',
      method: 'POST',
      path: '/api/research',
      priceAtomic: 2_500,
      maxPriceAtomic: 3_000,
      payTo: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
      inputSchema: {
        type: 'object',
        required: ['query'],
        properties: { query: { type: 'string', maxLength: 120 } },
        additionalProperties: false,
      },
      responseSchema: {
        type: 'object',
        required: ['answer'],
        properties: { answer: { type: 'string', maxLength: 1000 } },
        additionalProperties: false,
      },
      trust: 'external-curated',
      description: 'Curated external x402 research provider.',
      tags: ['research', 'x402'],
    };
    const registry = createResourceRegistry(shieldConfig.baseUrl, [external]);
    const result = evaluatePolicy({
      requestId: 'job_ext',
      resources: [{ id: 'external-research', input: { query: 'Algorand' }, maxPayment: 3_000, required: true }],
    }, shieldConfig, registry);
    expect(result).toMatchObject({ ok: true, quotedPriceAtomic: 4_000 });
  });

  it('rejects an unsupported external hash algorithm during policy evaluation before payment', () => {
    const registry = createResourceRegistry(
      shieldConfig.baseUrl,
      getTrustedExternalProviders('mainnet'),
    );
    const result = evaluatePolicy({
      requestId: 'job_bad_hash_algo',
      resources: [{
        id: 'external-hash',
        input: { text: 'CPMM-SHIELD', algo: 'garbage' },
        maxPayment: 1_000,
        required: true,
      }],
    }, shieldConfig, registry);

    expect(result).toMatchObject({ ok: false, code: 'invalid_resource_input' });
  });

  it('rejects duplicate resources and excessive counts', () => {
    const registry = createResourceRegistry(shieldConfig.baseUrl);
    const duplicate = request({ resources: [request().resources[0]!, request().resources[0]!] });
    expect(evaluatePolicy(duplicate, shieldConfig, registry)).toMatchObject({
      ok: false,
      code: 'duplicate_resource',
    });

    const tooMany = request({
      resources: [
        { id: 'weather', input: { city: 'Bangalore' }, maxPayment: 3_000, required: true },
        { id: 'company-lookup', input: { name: 'Algorand Foundation' }, maxPayment: 3_000, required: true },
        { id: 'sentiment-score', input: { text: 'fast' }, maxPayment: 3_000, required: true },
        { id: 'unknown', input: {}, maxPayment: 1, required: false },
      ],
    });
    expect(evaluatePolicy(tooMany, shieldConfig, registry)).toMatchObject({
      ok: false,
      code: 'too_many_resources',
    });
  });

  it('rejects per-resource and total overspend', () => {
    const registry = createResourceRegistry(shieldConfig.baseUrl);
    expect(
      evaluatePolicy(
        request({ resources: [{ ...request().resources[0]!, maxPayment: 10_001 }] }),
        shieldConfig,
        registry,
      ),
    ).toMatchObject({ ok: false, code: 'resource_over_budget' });

    const totalConfig = { ...shieldConfig, maxJobSpendAtomic: 3_500 };
    expect(evaluatePolicy(request(), totalConfig, registry)).toMatchObject({
      ok: false,
      code: 'job_over_budget',
    });
  });
});

describe('in-memory job store', () => {
  it('returns an existing job for the same request id and rejects changed input', () => {
    const store = new InMemoryJobStore();
    const first = store.create({
      jobId: 'job-a',
      request: request(),
      requestHash: 'hash-a',
      quotedPriceAtomic: 4_000,
      serviceFeeAtomic: 1_000,
      expiresAt: 20_000,
      binding: 'binding-a',
      createdAt: 10_000,
    });
    expect(store.create({ ...first, jobId: 'job-b' })).toBe(first);
    expect(() => store.create({ ...first, requestHash: 'hash-b' })).toThrow(/requestId/i);
  });

  it('allows only one processing claim and returns a cached terminal job', () => {
    const store = new InMemoryJobStore();
    store.create({
      jobId: 'job-a',
      request: request(),
      requestHash: 'hash-a',
      quotedPriceAtomic: 4_000,
      serviceFeeAtomic: 1_000,
      expiresAt: 20_000,
      binding: 'binding-a',
      createdAt: 10_000,
    });

    expect(store.claim('job-a')).toMatchObject({ acquired: true });
    expect(store.claim('job-a')).toMatchObject({ acquired: false, reason: 'processing' });
    store.complete('job-a', { jobId: 'job-a', status: 'COMPLETED' } as never);
    expect(store.claim('job-a')).toMatchObject({ acquired: false, reason: 'terminal' });
  });

  it('atomically rejects a payment proof already bound to another job', () => {
    const store = new InMemoryJobStore();
    expect(store.reservePayment('proof-a', 'job-a')).toEqual({ reserved: true });
    expect(store.reservePayment('proof-a', 'job-b')).toEqual({
      reserved: false,
      existingJobId: 'job-a',
    });
    store.releasePayment('proof-a', 'job-a');
    expect(store.reservePayment('proof-a', 'job-b')).toEqual({ reserved: true });
    store.consumePayment('proof-a', 'job-b');
    store.releasePayment('proof-a', 'job-b');
    expect(store.reservePayment('proof-a', 'job-a')).toEqual({
      reserved: false,
      existingJobId: 'job-b',
    });
  });
});

describe('audit log', () => {
  it('bounds retained events and redacts secret-looking fields', () => {
    const log = new AuditLog(2);
    log.record({ jobId: 'a', event: 'quoted', timestamp: 1, details: { mnemonic: 'secret words' } });
    log.record({ jobId: 'b', event: 'settled', timestamp: 2, details: { amount: 4_000 } });
    log.record({ jobId: 'c', event: 'completed', timestamp: 3, details: { privateKey: 'secret' } });

    expect(log.list()).toHaveLength(2);
    expect(JSON.stringify(log.list())).not.toContain('secret');
    expect(log.list()[1]).toMatchObject({ jobId: 'c', details: { privateKey: '[REDACTED]' } });
  });
});
