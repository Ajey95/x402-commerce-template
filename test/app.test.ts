import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { testConfig } from './config.js';

describe('CPMM-SHIELD HTTP API', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async input => {
        const url = String(input);
        if (url.endsWith('/supported')) {
          return Response.json({
            kinds: [
              {
                x402Version: 2,
                scheme: 'exact',
                network: testConfig.network,
                extra: { feePayer: testConfig.payTo },
              },
            ],
            extensions: [],
            signers: { 'algorand:*': [testConfig.payTo] },
          });
        }
        throw new Error(`Unexpected facilitator request: ${url}`);
      }),
    );
  });

  it('keeps the health route public and exposes non-secret readiness metadata', async () => {
    const response = await createApp(testConfig).request('/health');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ok',
      service: 'cpmm-shield',
      network: testConfig.network,
      challengeMode: false,
      facilitatorUrl: testConfig.facilitatorUrl,
      treasuryReady: false,
    });
  });

  it('serves the judge-facing CPMM-SHIELD operations dashboard and browser assets', async () => {
    const app = createApp(testConfig);
    const [page, styles, script] = await Promise.all([
      app.request('/'),
      app.request('/assets/styles.css'),
      app.request('/assets/app.js'),
    ]);

    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('One payment in.');
    expect(html).toContain('Many protected resources out.');
    expect(html).toContain('SIMULATED CONTENT');
    expect(html).toContain('REAL TESTNET PAYMENT');
    expect(html).toContain('Upstream payment');
    expect(html).toContain('Trusted providers');
    expect(html).toContain('Response firewall');
    expect(html).toContain('Signed receipt');
    expect(html).toContain('Run shield quote');
    expect(styles.headers.get('content-type')).toContain('text/css');
    expect(script.headers.get('content-type')).toContain('text/javascript');
    expect(await script.text()).toContain("input: { city: 'Bangalore' }");
  });

  it('keeps the server-side purchase agent disabled by default', async () => {
    const response = await createApp(testConfig).request('/demo/purchase', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address: testConfig.defaultWalletAddress }),
    });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: 'demo_disabled' });
  });

  it('rejects an invalid address before asking for payment', async () => {
    const response = await createApp(testConfig).request('/api/wallet/not-an-address');
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid_address' });
  });

  it('returns a real x402 challenge for an unpaid valid request', async () => {
    const indexerFetch = vi.fn<typeof fetch>();
    const response = await createApp(testConfig, { fetchImpl: indexerFetch }).request(
      '/api/wallet/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
    );

    expect(response.status).toBe(402);
    expect(response.headers.get('payment-required')).toBeTruthy();
    expect(indexerFetch).not.toHaveBeenCalled();
  });

  it('adds the Challenge tag only when challenge mode is enabled', async () => {
    const app = createApp({ ...testConfig, challengeMode: true });
    const response = await app.request(
      '/api/wallet/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
    );
    const encoded = response.headers.get('payment-required');
    expect(encoded).toBeTruthy();

    const paymentRequired = JSON.parse(Buffer.from(encoded!, 'base64url').toString('utf8')) as {
      accepts: Array<{ extra?: { tag?: string } }>;
    };
    expect(paymentRequired.accepts[0]?.extra?.tag).toBe('x402-global-challenge');
  });
});
