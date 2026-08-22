import type {
  HTTPProcessResult,
  HTTPRequestContext,
  ProcessSettleResultResponse,
  x402HTTPResourceServer,
} from '@x402/core/server';
import { HonoAdapter } from '@x402/hono';
import type { MiddlewareHandler } from 'hono';
import type { AuditLog } from './audit.js';
import { fingerprintPaymentHeader } from './binding.js';
import type { InMemoryJobStore } from './jobs.js';
import type { QuoteService } from './quote.js';

export type ShieldHttpServer = Pick<
  x402HTTPResourceServer,
  'initialize' | 'requiresPayment' | 'processHTTPRequest' | 'processSettlement'
>;

interface SettlementFirstOptions {
  server: ShieldHttpServer;
  quotes: QuoteService;
  store: InMemoryJobStore;
  audit: AuditLog;
  expected: { network: string; asset: string; payTo: string };
}

function applyInstructionResponse(
  c: Parameters<MiddlewareHandler>[0],
  response: Extract<HTTPProcessResult, { type: 'payment-error' }>['response'],
): Response {
  const headers = new Headers(response.headers);
  const body = response.isHtml ? String(response.body ?? '') : JSON.stringify(response.body ?? {});
  if (!response.isHtml && !headers.has('content-type')) headers.set('content-type', 'application/json');
  return new Response(body, { status: response.status, headers });
}

function applySettlementFailure(
  result: ProcessSettleResultResponse,
): Response {
  if (result.success) throw new Error('Expected a failed settlement result.');
  const headers = new Headers(result.response.headers);
  const body = result.response.isHtml
    ? String(result.response.body ?? '')
    : JSON.stringify(result.response.body ?? {});
  if (!result.response.isHtml && !headers.has('content-type')) headers.set('content-type', 'application/json');
  return new Response(body, { status: result.response.status, headers });
}

export function createSettlementFirstMiddleware(options: SettlementFirstOptions): MiddlewareHandler {
  let initialized: Promise<void> | undefined;
  const initialize = () => (initialized ??= options.server.initialize());

  return async (c, next) => {
    const adapter = new HonoAdapter(c);
    const paymentHeader = adapter.getHeader('payment-signature') || adapter.getHeader('x-payment');
    const context: HTTPRequestContext = {
      adapter,
      path: c.req.path,
      method: c.req.method,
      paymentHeader,
    };
    if (!options.server.requiresPayment(context)) return next();

    const job = await options.quotes.contextJob(context);
    const binding = options.quotes.verify(job);
    if (!binding.valid) {
      return c.json({ error: binding.reason, message: 'The shield quote is invalid or expired.' }, 409);
    }

    let fingerprint: string | undefined;
    if (paymentHeader) {
      fingerprint = fingerprintPaymentHeader(paymentHeader);
      const reservation = options.store.reservePayment(fingerprint, job.jobId);
      if (!reservation.reserved) {
        return c.json(
          {
            error: 'payment_replay',
            message: `This payment proof is already bound to job ${reservation.existingJobId}.`,
          },
          409,
        );
      }
    }

    let result: HTTPProcessResult;
    try {
      await initialize();
      result = await options.server.processHTTPRequest(context);
    } catch (error) {
      if (fingerprint) options.store.releasePayment(fingerprint, job.jobId);
      throw error;
    }

    if (result.type === 'no-payment-required') {
      if (fingerprint) options.store.releasePayment(fingerprint, job.jobId);
      return next();
    }
    if (result.type === 'payment-error') {
      if (fingerprint) options.store.releasePayment(fingerprint, job.jobId);
      return applyInstructionResponse(c, result.response);
    }
    if (!fingerprint) {
      await result.cancellationDispatcher.cancel({ reason: 'handler_failed', responseStatus: 402 });
      return c.json({ error: 'payment_required', message: 'A payment signature is required.' }, 402);
    }
    const requirementMatches =
      String(result.paymentRequirements.amount) === String(job.quotedPriceAtomic) &&
      result.paymentRequirements.network === options.expected.network &&
      String(result.paymentRequirements.asset) === options.expected.asset &&
      result.paymentRequirements.payTo === options.expected.payTo;
    if (!requirementMatches) {
      options.store.releasePayment(fingerprint, job.jobId);
      await result.cancellationDispatcher.cancel({ reason: 'handler_failed', responseStatus: 402 });
      return c.json(
        {
          error: 'payment_resource_mismatch',
          message: 'Payment amount, network, asset, or recipient does not match this job quote.',
        },
        402,
      );
    }

    const settlement = await options.server.processSettlement(
      result.paymentPayload,
      result.paymentRequirements,
      result.declaredExtensions,
      { request: context },
    );
    if (!settlement.success) {
      options.store.releasePayment(fingerprint, job.jobId);
      return applySettlementFailure(settlement);
    }

    options.store.consumePayment(fingerprint, job.jobId);
    options.store.setSettlement(job.jobId, fingerprint, settlement.transaction);
    options.audit.record({
      jobId: job.jobId,
      requestId: job.request.requestId,
      event: 'upstream_settled',
      timestamp: Date.now(),
      paymentIntentId: fingerprint,
      paymentStatus: 'settled',
      amountAtomic: job.quotedPriceAtomic,
      details: { transaction: settlement.transaction },
    });

    await next();
    for (const [header, value] of Object.entries(settlement.headers)) c.res.headers.set(header, value);
  };
}
