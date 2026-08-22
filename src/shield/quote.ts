import type { HTTPRequestContext } from '@x402/core/server';
import type { AuditLog } from './audit.js';
import { createQuoteBinding, hashExecuteRequest, verifyQuoteBinding } from './binding.js';
import type { InMemoryJobStore } from './jobs.js';
import { evaluatePolicy } from './policy.js';
import type { ResourceRegistry } from './registry.js';
import { parseExecuteShieldRequest, ShieldRequestError } from './request.js';
import type { ExecuteShieldRequest, JobRecord, ShieldConfig } from './types.js';

export class ShieldPolicyError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ShieldPolicyError';
  }
}

export interface QuoteServiceOptions {
  config: ShieldConfig;
  registry: ResourceRegistry;
  store: InMemoryJobStore;
  audit: AuditLog;
  bindingSecret: string;
  now?: () => number;
}

export interface PublicQuote {
  jobId: string;
  requestId: string;
  quotedPriceAtomic: number;
  quotedPrice: string;
  serviceFeeAtomic: number;
  expiresAt: string;
  binding: string;
  resourcePath: '/api/shield/execute';
}

function formatPrice(atomic: number): string {
  return `$${(atomic / 1_000_000).toFixed(6)}`;
}

export class QuoteService {
  private readonly now: () => number;

  constructor(private readonly options: QuoteServiceOptions) {
    this.now = options.now ?? Date.now;
  }

  prepare(request: ExecuteShieldRequest): JobRecord {
    const requestHash = hashExecuteRequest(request);
    const existing = this.options.store.getByRequestId(request.requestId);
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ShieldPolicyError('duplicate_request_id', 'requestId is already bound to different input.');
      }
      return existing;
    }

    const policy = evaluatePolicy(request, this.options.config, this.options.registry);
    if (!policy.ok) throw new ShieldPolicyError(policy.code, policy.message);
    const now = this.now();
    const expiresAt = now + this.options.config.quoteExpirySeconds * 1_000;
    const fields = {
      resourcePath: '/api/shield/execute',
      jobId: request.requestId,
      quotedPriceAtomic: policy.quotedPriceAtomic,
      expiresAt,
    } as const;
    const job = this.options.store.create({
      jobId: request.requestId,
      request,
      requestHash,
      quotedPriceAtomic: policy.quotedPriceAtomic,
      serviceFeeAtomic: this.options.config.serviceFeeAtomic,
      expiresAt,
      binding: createQuoteBinding(fields, this.options.bindingSecret),
      createdAt: now,
    });
    this.options.audit.record({
      jobId: job.jobId,
      requestId: request.requestId,
      event: 'quote_created',
      timestamp: now,
      amountAtomic: job.quotedPriceAtomic,
      resourceUrl: `${this.options.config.baseUrl}/api/shield/execute`,
    });
    return job;
  }

  fromUnknown(value: unknown): JobRecord {
    return this.prepare(parseExecuteShieldRequest(value));
  }

  publicQuote(job: JobRecord): PublicQuote {
    return {
      jobId: job.jobId,
      requestId: job.request.requestId,
      quotedPriceAtomic: job.quotedPriceAtomic,
      quotedPrice: formatPrice(job.quotedPriceAtomic),
      serviceFeeAtomic: job.serviceFeeAtomic,
      expiresAt: new Date(job.expiresAt).toISOString(),
      binding: job.binding,
      resourcePath: '/api/shield/execute',
    };
  }

  verify(job: JobRecord): { valid: true } | { valid: false; reason: string } {
    return verifyQuoteBinding(
      job.binding,
      {
        resourcePath: '/api/shield/execute',
        jobId: job.jobId,
        quotedPriceAtomic: job.quotedPriceAtomic,
        expiresAt: job.expiresAt,
      },
      this.options.bindingSecret,
      this.now(),
    );
  }

  async contextJob(context: HTTPRequestContext): Promise<JobRecord> {
    const body = await context.adapter.getBody?.();
    return this.fromUnknown(body);
  }

  async dynamicPrice(context: HTTPRequestContext): Promise<string> {
    return formatPrice((await this.contextJob(context)).quotedPriceAtomic);
  }

  async unpaidBody(context: HTTPRequestContext) {
    const job = await this.contextJob(context);
    return {
      contentType: 'application/json',
      body: {
        error: 'payment_required',
        message: 'Settle the quoted x402 payment before CPMM-SHIELD executes downstream resources.',
        quote: this.publicQuote(job),
      },
    };
  }
}

export function shieldError(error: unknown): { code: string; message: string; status: number } {
  if (error instanceof ShieldRequestError) return { code: error.code, message: error.message, status: 400 };
  if (error instanceof ShieldPolicyError) {
    return {
      code: error.code,
      message: error.message,
      status: error.code === 'duplicate_request_id' ? 409 : 400,
    };
  }
  return { code: 'invalid_request', message: 'The shield request is invalid.', status: 400 };
}

