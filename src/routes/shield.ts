import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Hono, MiddlewareHandler } from 'hono';
import type { AuditLog } from '../shield/audit.js';
import type { InMemoryJobStore } from '../shield/jobs.js';
import type { ShieldOrchestrator } from '../shield/orchestrator.js';
import type { QuoteService } from '../shield/quote.js';
import { shieldError } from '../shield/quote.js';
import type { ResourceRegistry } from '../shield/registry.js';

export function createShieldValidationMiddleware(
  quotes: QuoteService,
  _store: InMemoryJobStore,
): MiddlewareHandler {
  return async (c, next) => {
    try {
      const body = await c.req.json();
      const job = quotes.fromUnknown(body);
      if (job.receipt) return c.json(job.receipt);
      await next();
    } catch (error) {
      const response = shieldError(error);
      return c.json(
        { error: response.code, message: response.message },
        response.status as ContentfulStatusCode,
      );
    }
  };
}

export function registerShieldPublicRoutes(
  app: Hono,
  store: InMemoryJobStore,
  audit: AuditLog,
  registry: ResourceRegistry,
): void {
  app.get('/api/shield/resources', c =>
    c.json({
      resources: [...registry.values()].map(resource => ({
        id: resource.id,
        name: resource.name,
        method: resource.method,
        origin: resource.origin,
        path: resource.path,
        priceAtomic: resource.priceAtomic,
        trust: resource.trust,
        description: resource.description,
        tags: resource.tags,
        inputSchema: resource.inputSchema,
        content: resource.trust === 'owned-demo' ? 'SIMULATED CONTENT' : 'PROVIDER CONTENT',
        payment: 'REAL X402 PAYMENT',
      })),
    }),
  );
  app.get('/api/shield/jobs/:jobId', c => {
    const job = store.get(c.req.param('jobId'));
    if (!job) return c.json({ error: 'job_not_found', message: 'Shield job not found.' }, 404);
    if (job.receipt) return c.json(job.receipt);
    return c.json({
      jobId: job.jobId,
      requestId: job.request.requestId,
      status: job.status,
      quotedPriceAtomic: job.quotedPriceAtomic,
      expiresAt: new Date(job.expiresAt).toISOString(),
    }, 202);
  });
  app.get('/api/shield/audit', c => {
    const jobId = c.req.query('jobId');
    return c.json({ events: audit.list(jobId) });
  });
}

export function registerShieldExecuteRoute(app: Hono, orchestrator: ShieldOrchestrator): void {
  app.post('/api/shield/execute', async c => {
    const body = (await c.req.json()) as { requestId: string };
    try {
      return c.json(await orchestrator.execute(body.requestId));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Shield orchestration failed.';
      if (message.includes('already processing')) {
        return c.json({ error: 'job_processing', message }, 409);
      }
      return c.json({ error: 'orchestration_failed', message }, 502);
    }
  });
}
