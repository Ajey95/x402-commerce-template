import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { ExecuteShieldRequest } from './types.js';

export interface QuoteBindingFields {
  resourcePath: string;
  jobId: string;
  quotedPriceAtomic: number;
  expiresAt: number;
}

function canonicalFields(fields: QuoteBindingFields): string {
  return [fields.resourcePath, fields.jobId, String(fields.quotedPriceAtomic), String(fields.expiresAt)].join('\n');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

export function createQuoteBinding(fields: QuoteBindingFields, secret: string): string {
  if (secret.length < 24) throw new Error('Quote binding secret must contain at least 24 characters.');
  return createHmac('sha256', secret).update(canonicalFields(fields)).digest('base64url');
}

export function verifyQuoteBinding(
  binding: string,
  fields: QuoteBindingFields,
  secret: string,
  now = Date.now(),
): { valid: true } | { valid: false; reason: 'quote_expired' | 'binding_mismatch' } {
  if (now > fields.expiresAt) return { valid: false, reason: 'quote_expired' };
  const expected = createQuoteBinding(fields, secret);
  const actualBuffer = Buffer.from(binding);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return { valid: false, reason: 'binding_mismatch' };
  }
  return { valid: true };
}

export function hashExecuteRequest(request: ExecuteShieldRequest): string {
  return createHash('sha256').update(stableJson(request)).digest('base64url');
}

export function fingerprintPaymentHeader(header: string): string {
  return createHash('sha256').update(header).digest('base64url');
}

