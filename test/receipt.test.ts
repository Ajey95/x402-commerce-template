import algosdk from 'algosdk';
import { describe, expect, it } from 'vitest';
import {
  createReceiptSigner,
  type UnsignedReceipt,
  verifyReceipt,
} from '../src/shield/receipt.js';

function unsignedReceipt(): UnsignedReceipt {
  return {
    jobId: 'job-receipt',
    requestId: 'request-receipt',
    status: 'PARTIAL_FAILURE',
    summary: { requested: 1, completed: 0, failed: 1, rejections: 0 },
    payments: {
      upfront: '0.002000',
      downstream: '0.000000',
      serviceFee: '0.001000',
      remaining: '0.001000',
    },
    resources: [],
    results: {},
    settlementTxnId: 'UPSTREAM-job-receipt',
    generatedAt: '2026-08-23T12:00:00.000Z',
  };
}

describe('receipt canonical JSON', () => {
  it('serializes undefined array slots as null across JSON transport', () => {
    const signer = createReceiptSigner(algosdk.generateAccount());
    const receipt = signer.sign({
      ...unsignedReceipt(),
      resources: [undefined],
    } as unknown as UnsignedReceipt);

    const transported = JSON.parse(JSON.stringify(receipt)) as typeof receipt;
    expect(transported.resources).toEqual([null]);
    expect(verifyReceipt(transported)).toBe(true);
  });

  it('refuses to sign an invalid root value', () => {
    const signer = createReceiptSigner(algosdk.generateAccount());
    expect(() => signer.sign(undefined as unknown as UnsignedReceipt)).toThrow(
      'Receipt must be JSON-serializable.',
    );
  });
});
