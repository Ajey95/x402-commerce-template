import { describe, expect, it, vi } from 'vitest';
import { requestShieldJob, type ShieldPayer } from '../client/shield-client.js';

const request = { requestId: 'job_client', resources: [] };

describe('shield client', () => {
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
