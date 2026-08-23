import { z } from 'zod';
import type { ExecuteShieldRequest } from './types.js';

const requestedResource = z
  .object({
    id: z.string().min(1).max(80),
    input: z.record(z.unknown()).default({}),
    maxPayment: z.number().int().nonnegative(),
    required: z.boolean().default(true),
  })
  .strict();

const executeRequest = z
  .object({
    requestId: z.string().min(3).max(100).regex(/^[A-Za-z0-9_-]+$/),
    resources: z.array(requestedResource).min(1).max(50),
  })
  .strict();

export class ShieldRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ShieldRequestError';
  }
}

export function parseExecuteShieldRequest(value: unknown): ExecuteShieldRequest {
  const result = executeRequest.safeParse(value);
  if (!result.success) {
    throw new ShieldRequestError(
      'invalid_request',
      result.error.issues.map(issue => `${issue.path.join('.') || 'request'}: ${issue.message}`).join('; '),
    );
  }
  return result.data;
}
