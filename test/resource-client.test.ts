import { describe, expect, it } from 'vitest';
import { createPaidResourceClient } from '../src/shield/treasury.js';
import type { PaidFetchClient } from '../src/shield/treasury.js';
import { createResourceRegistry } from '../src/shield/registry.js';

const registry = createResourceRegistry('https://shield.example');
const definition = registry.get('weather')!;
const request = {
  id: 'weather',
  input: { city: 'Bangalore' },
  maxPayment: 3_000,
  required: true,
};

function payer(response: Response, settlement: { success: boolean; transaction?: string }): PaidFetchClient {
  return {
    address: 'TREASURY-ADDRESS',
    fetchWithPayment: async () => response,
    readSettlement: () => settlement,
  };
}

describe('treasury paid resource client', () => {
  it('maps validated input to the trusted provider URL and returns JSON only after settlement', async () => {
    let calledUrl = '';
    let calledInit: RequestInit | undefined;
    const paid: PaidFetchClient = {
      address: 'TREASURY-ADDRESS',
      fetchWithPayment: async (input, init) => {
        calledUrl = String(input);
        calledInit = init;
        return Response.json({ ok: true }, { headers: { 'payment-response': 'receipt' } });
      },
      readSettlement: () => ({ success: true, transaction: 'TX-123' }),
    };
    const client = createPaidResourceClient(paid, {
      timeoutMs: 1_000,
      maxResponseBytes: 1_024,
    });

    await expect(client.execute(request, definition, 'job-a')).resolves.toMatchObject({
      status: 200,
      transaction: 'TX-123',
      amountAtomic: 2_000,
      data: { ok: true },
    });
    expect(calledUrl).toBe('https://shield.example/api/resources/weather?city=Bangalore');
    expect(calledInit?.method).toBe('GET');
    expect(calledInit?.redirect).toBe('manual');
  });

  it('rejects a response without confirmed settlement', async () => {
    const client = createPaidResourceClient(
      payer(Response.json({ ok: true }), { success: false }),
      { timeoutMs: 1_000, maxResponseBytes: 1_024 },
    );
    await expect(client.execute(request, definition)).rejects.toMatchObject({
      code: 'settlement_unconfirmed',
      details: { paymentStatus: 'failed' },
    });
  });

  it.each([
    [new Response('plain text', { headers: { 'content-type': 'text/plain' } }), 'invalid_content_type'],
    [new Response('x'.repeat(1_025), { headers: { 'content-type': 'application/json' } }), 'response_too_large'],
    [new Response('{bad', { headers: { 'content-type': 'application/json' } }), 'invalid_json'],
    [new Response(null, { status: 302, headers: { location: 'https://attacker.example' } }), 'redirect_rejected'],
  ])('rejects unsafe response boundary: %s', async (response, code) => {
    const client = createPaidResourceClient(
      payer(response, { success: true, transaction: 'TX-123' }),
      { timeoutMs: 1_000, maxResponseBytes: 1_024 },
    );
    await expect(client.execute(request, definition)).rejects.toMatchObject({ code });
  });
});
