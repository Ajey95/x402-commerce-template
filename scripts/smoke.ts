import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { InMemoryJobStore } from '../src/shield/jobs.js';
import { verifyReceipt } from '../src/shield/receipt.js';
import { createAvmPayingClient } from '../src/x402/client.js';
import { clientNetwork } from '../client/lib.js';
import { createDemoShieldRequest, requestShieldJobWithProof } from '../client/shield-client.js';

const zeroAddress = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ';
const live = process.env.LIVE_X402 === 'true';

function pass(message: string) {
  console.log(`✓ ${message}`);
}

if (live) {
  const baseUrl = (process.env.API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const mnemonic = process.env.CLIENT_MNEMONIC?.trim();
  if (!mnemonic) throw new Error('LIVE_X402=true requires CLIENT_MNEMONIC.');
  const health = await fetch(`${baseUrl}/health`);
  if (!health.ok) throw new Error(`/health returned HTTP ${health.status}`);
  pass('live CPMM-SHIELD server is healthy');

  let capturedPayment = '';
  const captureFetch: typeof fetch = async (input, init) => {
    const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
    capturedPayment = headers.get('payment-signature') ?? headers.get('x-payment') ?? capturedPayment;
    return fetch(input, init);
  };
  const network = clientNetwork();
  const paying = createAvmPayingClient(mnemonic, network.name, captureFetch);
  const request = createDemoShieldRequest(
    baseUrl,
    `smoke_${randomUUID().replaceAll('-', '').slice(0, 16)}`,
    network.name,
  );
  const proof = await requestShieldJobWithProof(baseUrl, request, {
    fetchWithPayment: paying.fetchWithPayment,
    readSettlement: response => paying.httpClient.getPaymentSettleResponse(name => response.headers.get(name)),
  });
  if (!verifyReceipt(proof.receipt)) throw new Error('The aggregate receipt signature is invalid.');
  if (proof.receipt.summary.completed !== 3) throw new Error('Expected all three downstream resources to complete.');
  pass(`real upstream and downstream settlements completed; transaction ${proof.transaction}`);
  pass('three resource responses were validated and the aggregate receipt signature verifies');

  if (!capturedPayment) throw new Error('Could not capture the paid retry proof for replay verification.');
  const replayRequest = { ...request, requestId: `replay_${randomUUID().replaceAll('-', '').slice(0, 16)}` };
  const replay = await fetch(`${baseUrl}/api/shield/execute`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'payment-signature': capturedPayment },
    body: JSON.stringify(replayRequest),
  });
  if (replay.status !== 409) throw new Error(`Replay returned HTTP ${replay.status}, expected 409.`);
  pass('captured settled payment replay was rejected against a different job');
} else {
  console.log('CPMM-SHIELD STRUCTURAL SMOKE — NO FUNDS MOVED');
  const config = loadConfig({
    ...process.env,
    PORT: '3000',
    API_BASE_URL: 'http://localhost:3000',
    ALGORAND_NETWORK: 'testnet',
    PAY_TO_ADDRESS: zeroAddress,
    WALLET_ADDRESS: zeroAddress,
    DEMO_MODE: 'true',
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    if (String(input).endsWith('/supported')) {
      return Response.json({
        kinds: [{ x402Version: 2, scheme: 'exact', network: config.network, extra: { feePayer: config.payTo } }],
        extensions: [],
        signers: { 'algorand:*': [config.payTo] },
      });
    }
    throw new Error(`Unexpected external smoke request: ${String(input)}`);
  };
  try {
    const app = createApp(config);
    const health = await app.request('/health');
    if (!health.ok) throw new Error(`/health returned HTTP ${health.status}`);
    pass('/health and dashboard application initialize');
    const resources = await app.request('/api/shield/resources');
    const registry = await resources.json() as { resources: unknown[] };
    if (registry.resources.length !== 4) throw new Error('Trusted registry must expose four active resources.');
    pass('trusted four-resource registry is public');
    const request = createDemoShieldRequest(config.shield.baseUrl, 'smoke_quote', config.networkName);
    if (request.resources.length !== 3) throw new Error('Deterministic job must request exactly three resources.');
    const unpaid = await app.request('/api/shield/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (unpaid.status !== 402 || !unpaid.headers.get('payment-required')) {
      throw new Error('Shield endpoint did not return an official HTTP 402 challenge.');
    }
    const body = await unpaid.json() as { quote?: { quotedPriceAtomic?: number } };
    if (body.quote?.quotedPriceAtomic !== 7_000) throw new Error('Dynamic quote should be 0.007000 USDC.');
    pass('valid three-resource job returns a bound, dynamic-price x402 challenge');
    const malformed = await app.request('/api/shield/execute', { method: 'POST', body: '{bad' });
    if (malformed.status !== 400) throw new Error('Malformed input was not rejected before payment.');
    pass('malformed input is rejected before a payment challenge');
    const store = new InMemoryJobStore();
    if (!store.reservePayment('captured-proof', 'job-a').reserved) throw new Error('Could not reserve proof.');
    store.consumePayment('captured-proof', 'job-a');
    if (store.reservePayment('captured-proof', 'job-b').reserved) throw new Error('Replay reservation was accepted.');
    pass('consumed payment proof cannot be rebound to another job');
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log('Live settlement skipped. Run with LIVE_X402=true and funded TestNet credentials for the real payment smoke.');
}
