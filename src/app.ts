import algosdk from 'algosdk';
import { createHash, randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import type { RuntimeConfig } from './config.js';
import { createDemoPurchaseHandler } from './routes/demo.js';
import { createShieldDemoHandler } from './routes/shield-demo.js';
import { registerResourceHandlers, registerResourceValidation } from './routes/resources.js';
import {
  createShieldValidationMiddleware,
  registerShieldExecuteRoute,
  registerShieldPublicRoutes,
} from './routes/shield.js';
import { createWalletHandler } from './routes/wallet.js';
import { AlgorandService } from './services/algorand.js';
import { AuditLog } from './shield/audit.js';
import { InMemoryJobStore } from './shield/jobs.js';
import { ShieldOrchestrator } from './shield/orchestrator.js';
import { createSettlementFirstMiddleware, type ShieldHttpServer } from './shield/payment-manager.js';
import { QuoteService } from './shield/quote.js';
import { createReceiptSigner, createReceiptSignerFromMnemonic, type ReceiptSigner } from './shield/receipt.js';
import { createResourceRegistry, type ResourceRegistry } from './shield/registry.js';
import { ResourceCallError, type ResourceClient } from './shield/resource-client.js';
import { createTreasuryResourceClient } from './shield/treasury.js';
import { getTrustedExternalProviders } from './shield/trusted-providers.js';
import { APP_SCRIPT } from './web/app-script.js';
import { renderPage } from './web/page.js';
import { STYLES } from './web/styles.js';
import { createShieldHttpServer, createX402Middleware } from './x402/config.js';

export interface AppOptions {
  fetchImpl?: typeof fetch;
  store?: InMemoryJobStore;
  audit?: AuditLog;
  resourceClient?: ResourceClient;
  receiptSigner?: ReceiptSigner;
  registry?: ResourceRegistry;
  bindingSecret?: string;
  shieldHttpServer?: ShieldHttpServer;
  now?: () => number;
}

function createBindingSecret(config: RuntimeConfig, provided?: string): string {
  if (provided) return provided;
  if (config.treasuryMnemonic) {
    return createHash('sha256').update(`cpmm-shield:${config.treasuryMnemonic}`).digest('hex');
  }
  return randomBytes(32).toString('hex');
}

function unavailableResourceClient(): ResourceClient {
  return {
    async execute() {
      throw new ResourceCallError(
        'treasury_unavailable',
        'TREASURY_MNEMONIC is required before CPMM-SHIELD can pay downstream resources.',
        { paymentStatus: 'not_started', durationMs: 0 },
      );
    },
  };
}

export function createApp(config: RuntimeConfig, options: AppOptions = {}) {
  const app = new Hono();
  const algorand = new AlgorandService(config.indexerUrl, Number(config.usdcAssetId), options.fetchImpl);
  const store = options.store ?? new InMemoryJobStore();
  const audit = options.audit ?? new AuditLog();
  const registry = options.registry ?? createResourceRegistry(
    config.shield.baseUrl,
    getTrustedExternalProviders(config.networkName),
  );
  const quotes = new QuoteService({
    config: config.shield,
    registry,
    store,
    audit,
    bindingSecret: createBindingSecret(config, options.bindingSecret),
    now: options.now,
  });
  const treasury = options.resourceClient
    ? { address: undefined, client: options.resourceClient }
    : config.treasuryMnemonic
      ? createTreasuryResourceClient(config, options.fetchImpl)
      : { address: undefined, client: unavailableResourceClient() };
  const receiptSigner =
    options.receiptSigner ??
    (config.treasuryMnemonic
      ? createReceiptSignerFromMnemonic(config.treasuryMnemonic)
      : createReceiptSigner(algosdk.generateAccount()));
  const orchestrator = new ShieldOrchestrator({
    store,
    audit,
    registry,
    resourceClient: treasury.client,
    receiptSigner,
  });
  const shieldHttpServer = options.shieldHttpServer ?? createShieldHttpServer(config, quotes);

  app.get('/', c => c.html(renderPage(config)));
  app.get('/assets/styles.css', c =>
    c.body(STYLES, 200, { 'Content-Type': 'text/css; charset=utf-8' }),
  );
  app.get('/assets/app.js', c =>
    c.body(APP_SCRIPT, 200, { 'Content-Type': 'text/javascript; charset=utf-8' }),
  );
  app.get('/health', c =>
    c.json({
      status: 'ok',
      service: 'cpmm-shield',
      network: config.network,
      challengeMode: config.challengeMode,
      facilitatorUrl: config.facilitatorUrl,
      treasuryReady: Boolean(config.treasuryMnemonic || options.resourceClient),
      demoReady: config.demoMode && Boolean(config.demoMnemonic && config.treasuryMnemonic),
      treasuryAddress: treasury.address,
      receiptPublicKey: receiptSigner.publicKey,
    }),
  );
  registerShieldPublicRoutes(app, store, audit, registry);
  app.post('/demo/purchase', createDemoPurchaseHandler(config));
  app.post('/demo/shield', createShieldDemoHandler(config));

  // Parse, validate, budget, and bind the trusted job before a payment challenge can be emitted.
  app.use('/api/shield/execute', createShieldValidationMiddleware(quotes, store));
  app.use(
    '/api/shield/execute',
    createSettlementFirstMiddleware({
      server: shieldHttpServer,
      quotes,
      store,
      audit,
      expected: { network: config.network, asset: config.usdcAssetId, payTo: config.payTo },
    }),
  );
  registerShieldExecuteRoute(app, orchestrator);

  // Reject malformed input before x402 so callers are never charged for an invalid request.
  app.use('/api/wallet/:address', async (c, next) => {
    if (!algosdk.isValidAddress(c.req.param('address'))) {
      return c.json(
        {
          error: 'invalid_address',
          message: 'Address must be a valid Algorand address.',
        },
        400,
      );
    }
    await next();
  });

  registerResourceValidation(app);
  app.use(createX402Middleware(config, registry));
  app.get('/api/wallet/:address', createWalletHandler(algorand));
  registerResourceHandlers(app);

  app.notFound(c => c.json({ error: 'not_found', message: 'Route not found.' }, 404));
  app.onError((error, c) => {
    console.error(error);
    const message = error.message.toLowerCase();
    if (
      message.includes('facilitator') ||
      message.includes('payment') ||
      message.includes('settle') ||
      message.includes('verify') ||
      message.includes('fetch')
    ) {
      return c.json(
        {
          error: 'payment_service_unavailable',
          message:
            'x402 payment processing is unavailable. Check FACILITATOR_URL, network compatibility, and facilitator status.',
        },
        503,
      );
    }
    return c.json({ error: 'internal_error', message: 'The paid resource could not complete the request.' }, 500);
  });
  return app;
}
