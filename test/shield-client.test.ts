import { describe, expect, it, vi } from 'vitest';
import { createDemoShieldRequest, requestShieldJob, type ShieldPayer } from '../client/shield-client.js';

const request = {
  requestId: 'job_client',
  resources: [{ id: 'weather', input: { city: 'Bangalore' }, maxPayment: 3_000, required: true }],
};

describe('shield client', () => {
  it('builds the TestNet deterministic demo with the curated price provider by default', () => {
    const demo = createDemoShieldRequest('https://shield.test', 'job_demo');
    expect(demo).toEqual({
      requestId: 'job_demo',
      resources: [
        { id: 'weather', input: { city: 'Bangalore' }, maxPayment: 2_000, required: true },
        { id: 'company-lookup', input: { name: 'Algorand Foundation' }, maxPayment: 3_000, required: true },
        {
          id: 'external-algo-price',
          input: {},
          maxPayment: 1_000,
          required: true,
        },
      ],
    });
    expect(JSON.stringify(demo)).not.toContain('expectedSchema');
    expect(JSON.stringify(demo)).not.toContain('/api/resources/');
  });

  it('builds the MainNet deterministic demo with the curated hash provider', () => {
    expect(createDemoShieldRequest('https://shield.test', 'job_mainnet', 'mainnet')).toEqual({
      requestId: 'job_mainnet',
      resources: [
        { id: 'weather', input: { city: 'Bangalore' }, maxPayment: 2_000, required: true },
        { id: 'company-lookup', input: { name: 'Algorand Foundation' }, maxPayment: 3_000, required: true },
        {
          id: 'external-hash',
          input: { text: 'CPMM-SHIELD', algo: 'sha256' },
          maxPayment: 1_000,
          required: true,
        },
      ],
    });
  });

  it('requires a 402 quote, a successful paid response, and confirmed settlement', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(
      Response.json({ error: 'payment_required', quote: { quotedPriceAtomic: 4_000 } }, { status: 402 }),
    );
    const payer: ShieldPayer = {
      fetchWithPayment: vi.fn().mockResolvedValue(Response.json({ jobId: 'job_client', status: 'COMPLETED' })),
      readSettlement: () => ({ success: true, transaction: 'UPSTREAM-TX' }),
    };

    await expect(requestShieldJob('https://shield.test', request, payer, fetchImpl)).resolves.toMatchObject({
      jobId: 'job_client',
      status: 'COMPLETED',
    });
    expect(payer.fetchWithPayment).toHaveBeenCalledWith(
      'https://shield.test/api/shield/execute',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(request) }),
    );
  });

  it('rejects a paid response without a confirmed settlement receipt', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({}, { status: 402 }));
    const payer: ShieldPayer = {
      fetchWithPayment: vi.fn().mockResolvedValue(Response.json({ status: 'COMPLETED' })),
      readSettlement: () => ({ success: false }),
    };
    await expect(requestShieldJob('https://shield.test', request, payer, fetchImpl)).rejects.toThrow(
      'settlement was not confirmed',
    );
  });

  it('surfaces the encoded x402 reason when the paid retry is rejected', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({}, { status: 402 }));
    const encoded = Buffer.from(JSON.stringify({ error: 'payer has insufficient balance' })).toString('base64url');
    const payer: ShieldPayer = {
      fetchWithPayment: vi.fn().mockResolvedValue(
        Response.json({}, { status: 402, headers: { 'payment-required': encoded } }),
      ),
      readSettlement: () => ({ success: false }),
    };
    await expect(requestShieldJob('https://shield.test', request, payer, fetchImpl)).rejects.toThrow(
      'payer has insufficient balance',
    );
  });
});
