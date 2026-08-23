import type { AuditLog } from './audit.js';
import type { InMemoryJobStore } from './jobs.js';
import type { ReceiptSigner, UnsignedReceipt } from './receipt.js';
import type { ResourceRegistry } from './registry.js';
import { ResourceCallError, type ResourceClient } from './resource-client.js';
import type { ResourceOutcome, ShieldReceipt } from './types.js';
import { validateResourceResponse } from './validator.js';

interface OrchestratorDependencies {
  store: InMemoryJobStore;
  audit: AuditLog;
  registry: ResourceRegistry;
  resourceClient: ResourceClient;
  receiptSigner: ReceiptSigner;
}

function formatAtomic(amount: number): string {
  return (amount / 1_000_000).toFixed(6);
}

export class ShieldOrchestrator {
  constructor(private readonly dependencies: OrchestratorDependencies) {}

  async execute(jobId: string): Promise<ShieldReceipt> {
    const { store, audit, registry, resourceClient, receiptSigner } = this.dependencies;
    const claim = store.claim(jobId);
    if (!claim.acquired) {
      if (claim.reason === 'terminal' && claim.job?.receipt) return claim.job.receipt;
      if (claim.reason === 'processing') throw new Error('Job is already processing.');
      throw new Error(`Unknown job ${jobId}.`);
    }
    const job = claim.job;
    if (!job.settlementTxnId) {
      store.fail(jobId);
      throw new Error('Upstream payment settlement must be confirmed before execution.');
    }

    audit.record({
      jobId,
      requestId: job.request.requestId,
      event: 'orchestration_started',
      timestamp: Date.now(),
      paymentStatus: 'settled',
      amountAtomic: job.quotedPriceAtomic,
    });

    const resources: ResourceOutcome[] = [];
    const results: Record<string, unknown> = {};
    let downstreamAtomic = 0;
    let completed = 0;
    let rejections = 0;

    for (const request of job.request.resources) {
      const definition = registry.get(request.id);
      if (!definition) {
        resources.push({
          id: request.id,
          paymentStatus: 'not_started',
          validation: 'not_run',
          amountAtomic: 0,
          durationMs: 0,
          errorCode: 'resource_not_registered',
          errorMessage: 'Resource was removed from the trusted registry.',
        });
        continue;
      }

      try {
        const call = await resourceClient.execute(request, definition, jobId);
        downstreamAtomic += call.amountAtomic;
        const validation = validateResourceResponse(call.data, definition.responseSchema);
        if (!validation.ok) {
          rejections += 1;
          resources.push({
            id: request.id,
            paymentStatus: 'settled',
            responseStatus: call.status,
            validation: 'rejected',
            txnId: call.transaction,
            amountAtomic: call.amountAtomic,
            durationMs: call.durationMs,
            errorCode: validation.code,
            errorMessage: validation.reason,
          });
          audit.record({
            jobId,
            requestId: job.request.requestId,
            resourceId: request.id,
            event: 'response_rejected',
            timestamp: Date.now(),
            paymentStatus: 'settled',
            amountAtomic: call.amountAtomic,
            resourceUrl: `${definition.origin}${definition.path}`,
            responseStatus: call.status,
            validationResult: validation.code,
            durationMs: call.durationMs,
          });
          continue;
        }

        completed += 1;
        results[request.id] = validation.data;
        resources.push({
          id: request.id,
          paymentStatus: 'settled',
          responseStatus: call.status,
          validation: 'passed',
          txnId: call.transaction,
          amountAtomic: call.amountAtomic,
          durationMs: call.durationMs,
        });
        audit.record({
          jobId,
          requestId: job.request.requestId,
          resourceId: request.id,
          event: 'resource_completed',
          timestamp: Date.now(),
          paymentStatus: 'settled',
          amountAtomic: call.amountAtomic,
          resourceUrl: `${definition.origin}${definition.path}`,
          responseStatus: call.status,
          validationResult: 'passed',
          durationMs: call.durationMs,
        });
      } catch (error) {
        const failure =
          error instanceof ResourceCallError
            ? error
            : new ResourceCallError('downstream_error', 'The downstream resource failed.', {
                paymentStatus: 'failed',
                durationMs: 0,
              });
        if (failure.details.paymentStatus === 'settled') {
          downstreamAtomic += failure.details.amountAtomic ?? definition.priceAtomic;
        }
        resources.push({
          id: request.id,
          paymentStatus: failure.details.paymentStatus,
          responseStatus: failure.details.status,
          validation: 'not_run',
          txnId: failure.details.transaction,
          amountAtomic: failure.details.amountAtomic ?? 0,
          durationMs: failure.details.durationMs,
          errorCode: failure.code,
          errorMessage: failure.message,
        });
        audit.record({
          jobId,
          requestId: job.request.requestId,
          resourceId: request.id,
          event: 'resource_failed',
          timestamp: Date.now(),
          paymentStatus: failure.details.paymentStatus,
          amountAtomic: failure.details.amountAtomic,
          resourceUrl: `${definition.origin}${definition.path}`,
          responseStatus: failure.details.status,
          validationResult: 'not_run',
          durationMs: failure.details.durationMs,
          errorCode: failure.code,
        });
      }
    }

    const failed = resources.length - completed;
    const requiredFailed = job.request.resources.some(request => {
      if (!request.required) return false;
      const outcome = resources.find(item => item.id === request.id);
      return !outcome || outcome.validation !== 'passed';
    });
    const status = requiredFailed
      ? completed === 0 ? 'FAILED' : 'PARTIAL_FAILURE'
      : failed === 0 ? 'COMPLETED' : 'PARTIAL_FAILURE';
    const remainingAtomic = Math.max(0, job.quotedPriceAtomic - downstreamAtomic - job.serviceFeeAtomic);
    const unsigned: UnsignedReceipt = {
      jobId,
      requestId: job.request.requestId,
      status,
      summary: { requested: resources.length, completed, failed, rejections },
      payments: {
        upfront: formatAtomic(job.quotedPriceAtomic),
        downstream: formatAtomic(downstreamAtomic),
        serviceFee: formatAtomic(job.serviceFeeAtomic),
        remaining: formatAtomic(remainingAtomic),
      },
      resources,
      results,
      settlementTxnId: job.settlementTxnId,
      generatedAt: new Date().toISOString(),
    };
    const receipt = receiptSigner.sign(unsigned);
    store.complete(jobId, receipt);
    audit.record({
      jobId,
      requestId: job.request.requestId,
      event: 'job_completed',
      timestamp: Date.now(),
      paymentStatus: 'settled',
      amountAtomic: job.quotedPriceAtomic,
      validationResult: status,
    });
    return receipt;
  }
}
