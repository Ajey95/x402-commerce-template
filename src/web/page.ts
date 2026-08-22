import type { RuntimeConfig } from '../config.js';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function renderPage(config: RuntimeConfig): string {
  const receiver = escapeHtml(config.payTo);
  const network = escapeHtml(config.networkName.toUpperCase());
  const demoReady = config.demoMode && Boolean(config.demoMnemonic && config.treasuryMnemonic);
  const mode = demoReady ? 'DEMO PAYER READY' : 'QUOTE-ONLY MODE';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="CPMM-SHIELD orchestrates one x402 payment into multiple validated Algorand resources." />
    <title>CPMM-SHIELD — Protected x402 orchestration</title>
    <link rel="stylesheet" href="/assets/styles.css" />
    <script src="/assets/app.js" defer></script>
  </head>
  <body data-demo-ready="${demoReady}">
    <div class="grain" aria-hidden="true"></div>
    <header class="site-header">
      <a class="brand" href="/" aria-label="CPMM-SHIELD home">
        <span class="brand-mark" aria-hidden="true"></span>
        <span><b>CPMM</b>-SHIELD<small>SECURE x402 ORCHESTRATION</small></span>
      </a>
      <div class="header-meta">
        <span class="live-dot"></span><span>ALGORAND ${network}</span>
        <span class="divider"></span><span>${mode}</span>
      </div>
    </header>

    <main>
      <section class="overview">
        <div class="intro">
          <p class="kicker">AGENTIC COMMERCE · POLICY-BOUND EXECUTION</p>
          <h1 aria-label="One payment in. Many protected resources out.">One payment in.<br /><em>Many protected resources out.</em></h1>
          <p class="lede">CPMM-SHIELD settles one upstream x402 payment, isolates the client wallet, pays trusted resources from a dedicated treasury, validates every payload, and signs one auditable receipt.</p>
          <div class="truth-labels"><span class="sim-label">SIMULATED CONTENT</span><span class="real-label">REAL TESTNET PAYMENT</span></div>
        </div>
        <div class="metric-grid" aria-label="Shield summary">
          <article><span>UPFRONT QUOTE</span><strong id="metric-upfront">—</strong><small>USDC</small></article>
          <article><span>DOWNSTREAM</span><strong id="metric-downstream">—</strong><small>USDC</small></article>
          <article><span>REMAINING</span><strong id="metric-remaining">—</strong><small>BUDGET</small></article>
          <article><span>RESOURCES</span><strong id="metric-resources">0/3</strong><small>COMPLETED</small></article>
          <article><span>VALIDATION</span><strong id="metric-validation">0/3</strong><small>PASSED</small></article>
          <article class="treasury-card"><span>TREASURY</span><strong id="metric-treasury">${config.treasuryMnemonic ? 'READY' : 'NOT SET'}</strong><small title="${receiver}">${receiver.slice(0, 7)}…${receiver.slice(-5)}</small></article>
        </div>
      </section>

      <section class="flow-panel" aria-labelledby="flow-title">
        <div class="section-heading"><div><p class="kicker">CONTROL PLANE</p><h2 id="flow-title">Execution flow</h2></div><span id="flow-state" class="state-pill">READY</span></div>
        <div class="flow" aria-label="Client to protected resources flow">
          <div class="flow-node primary" data-flow="client"><span class="node-index">01</span><b>AI client</b><small>One signed intent</small></div>
          <span class="connector"><i></i><small>REQUEST</small></span>
          <div class="flow-node" data-flow="quote"><span class="node-index">02</span><b>HTTP 402</b><small>Bound job quote</small></div>
          <span class="connector"><i></i><small>SETTLE</small></span>
          <div class="flow-node shield-node" data-flow="shield"><span class="shield-mini"></span><b>CPMM-SHIELD</b><small>Policy · pay · validate</small></div>
          <span class="connector"><i></i><small>TREASURY</small></span>
          <div class="resource-stack">
            <div data-resource="weather"><span>W</span><p><b>Weather</b><small>Waiting</small></p><i></i></div>
            <div data-resource="company-lookup"><span>C</span><p><b>Company lookup</b><small>Waiting</small></p><i></i></div>
            <div data-resource="sentiment-score"><span>S</span><p><b>Sentiment score</b><small>Waiting</small></p><i></i></div>
          </div>
          <span class="connector"><i></i><small>SIGN</small></span>
          <div class="flow-node result-node" data-flow="result"><span class="node-index">06</span><b>Receipt</b><small>Aggregated result</small></div>
        </div>
      </section>

      <section class="console-grid">
        <article class="runner-panel">
          <div class="section-heading compact"><div><p class="kicker">JOB COMPOSER</p><h2>Run a protected job</h2></div><span class="network-chip">ASA ${escapeHtml(config.usdcAssetId)}</span></div>
          <p class="panel-copy">Builds a three-resource request, validates policy, and returns a real x402 quote. With local demo credentials configured, the server-side payer can complete it without exposing keys to this browser.</p>
          <form id="shield-form">
            <label for="job-description">Agent goal</label>
            <textarea id="job-description" rows="3">Get Bangalore weather, look up Algorand Foundation, and score this review: “Secure, scalable and fast.”</textarea>
            <div class="form-row"><div><label for="job-id">Request ID</label><input id="job-id" autocomplete="off" /></div><button id="run-button" type="submit">Run shield quote <span aria-hidden="true">→</span></button></div>
          </form>
          <div id="runner-message" class="runner-message" aria-live="polite"><span></span><p><b>Ready for an intent.</b><small>No payment is requested until policy validation passes.</small></p></div>
          <div id="quote-card" class="quote-card" hidden>
            <div><span>BOUND JOB</span><code id="quote-job">—</code></div>
            <div><span>QUOTE</span><strong id="quote-price">—</strong></div>
            <div><span>EXPIRES</span><strong id="quote-expiry">—</strong></div>
          </div>
        </article>

        <aside class="registry-panel">
          <div class="section-heading compact"><div><p class="kicker">ALLOWLIST</p><h2>Trusted resources</h2></div><span id="registry-count">3 ACTIVE</span></div>
          <div id="resource-registry" class="registry-list"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>
          <div class="policy-note"><span aria-hidden="true">⌁</span><p><b>Exact URL policy</b><small>Private networks, redirects, duplicate spend, excess price, and oversized payloads are rejected.</small></p></div>
        </aside>
      </section>

      <section class="results-grid">
        <article class="result-panel">
          <div class="section-heading compact"><div><p class="kicker">SIGNED OUTPUT</p><h2>Aggregated result</h2></div><span id="result-status" class="state-pill neutral">NO RECEIPT</span></div>
          <pre id="result-json">{
  "status": "awaiting_settlement",
  "message": "Run a quote or execute the paid CLI flow."
}</pre>
        </article>
        <article class="audit-panel">
          <div class="section-heading compact"><div><p class="kicker">OBSERVABILITY</p><h2>Audit trail</h2></div><button id="refresh-audit" class="icon-button" type="button" title="Refresh audit trail" aria-label="Refresh audit trail">↻</button></div>
          <div class="audit-head"><span>TIME / EVENT</span><span>RESOURCE</span><span>PAYMENT</span></div>
          <div id="audit-list" class="audit-list"><p class="empty-state">No events yet. Every quote, settlement, validation, and failure appears here.</p></div>
        </article>
      </section>
    </main>
    <footer><span>CPMM-SHIELD · AGENTIC SOLUTIONS TRACK</span><span>HTTP 402 → ALGORAND USDC → VALIDATED JSON</span></footer>
  </body>
</html>`;
}
