export const APP_SCRIPT = String.raw`
const form = document.querySelector('#shield-form');
const runButton = document.querySelector('#run-button');
const jobInput = document.querySelector('#job-id');
const runnerMessage = document.querySelector('#runner-message');
const quoteCard = document.querySelector('#quote-card');
const resultJson = document.querySelector('#result-json');
const resultStatus = document.querySelector('#result-status');
const flowState = document.querySelector('#flow-state');
const demoReady = document.body.dataset.demoReady === 'true';
const activeNetwork = document.body.dataset.network === 'mainnet' ? 'mainnet' : 'testnet';
let activeJobId = '';

function makeJobId() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return 'job_' + [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function atomic(value) {
  return (Number(value || 0) / 1_000_000).toFixed(6);
}

function setMessage(kind, title, detail) {
  runnerMessage.className = 'runner-message ' + kind;
  runnerMessage.querySelector('b').textContent = title;
  runnerMessage.querySelector('small').textContent = detail;
}

function setFlow(name, state) {
  const node = document.querySelector('[data-flow="' + name + '"]');
  if (node) node.classList.toggle('active', state === 'active');
  flowState.className = 'state-pill ' + (state === 'failed' ? 'failed' : state === 'done' ? 'complete' : 'working');
  flowState.textContent = state === 'failed' ? 'FAILED' : state === 'done' ? 'COMPLETED' : 'RUNNING';
}

function makeRequest(requestId) {
  const external = activeNetwork === 'mainnet'
    ? { id: 'external-hash', input: { text: 'CPMM-SHIELD', algo: 'sha256' }, maxPayment: 1000, required: true }
    : { id: 'external-algo-price', input: {}, maxPayment: 1000, required: true };
  return {
    requestId,
    resources: [
      { id: 'weather', input: { city: 'Bangalore' }, maxPayment: 2000, required: true },
      { id: 'company-lookup', input: { name: 'Algorand Foundation' }, maxPayment: 3000, required: true },
      external
    ]
  };
}

function renderQuote(quote) {
  quoteCard.hidden = false;
  document.querySelector('#quote-job').textContent = quote.jobId;
  document.querySelector('#quote-price').textContent = quote.quotedPrice;
  document.querySelector('#quote-expiry').textContent = new Date(quote.expiresAt).toLocaleTimeString();
  document.querySelector('#metric-upfront').textContent = atomic(quote.quotedPriceAtomic);
  resultJson.textContent = JSON.stringify({ status: 'payment_required', quote }, null, 2);
  resultStatus.textContent = '402 QUOTED';
  resultStatus.className = 'state-pill working';
}

function renderReceipt(receipt) {
  const complete = receipt.summary?.completed || 0;
  const requested = receipt.summary?.requested || receipt.resources?.length || 0;
  const passed = (receipt.resources || []).filter(item => item.validation === 'passed').length;
  document.querySelector('#metric-upfront').textContent = receipt.payments?.upfront || '—';
  document.querySelector('#metric-downstream').textContent = receipt.payments?.downstream || '—';
  document.querySelector('#metric-remaining').textContent = receipt.payments?.remaining || '—';
  document.querySelector('#metric-resources').textContent = complete + '/' + requested;
  document.querySelector('#metric-validation').textContent = passed + '/' + requested;
  resultJson.textContent = JSON.stringify(receipt, null, 2);
  resultStatus.textContent = receipt.status;
  resultStatus.className = 'state-pill ' + (receipt.status === 'COMPLETED' ? 'complete' : 'failed');
  for (const item of receipt.resources || []) {
    const row = document.querySelector('[data-resource="' + item.id + '"]');
    if (!row) continue;
    row.className = item.validation === 'passed' ? 'done' : 'failed';
    const detail = item.validation === 'passed'
      ? 'Settled ' + atomic(item.amountAtomic) + ' · validated' + (item.txnId ? ' · ' + item.txnId.slice(0, 10) + '…' : '')
      : (item.errorCode || 'Failed');
    row.querySelector('small').textContent = detail;
  }
  setFlow('result', receipt.status === 'COMPLETED' ? 'done' : 'failed');
}

async function loadRegistry() {
  const container = document.querySelector('#resource-registry');
  try {
    const response = await fetch('/api/shield/resources');
    const data = await response.json();
    container.innerHTML = data.resources.map(item =>
      '<div class="registry-item">' +
        '<span>' + escapeHtml(item.id.charAt(0).toUpperCase()) + '</span>' +
        '<p><b>' + escapeHtml(item.name || item.id) + '</b><small>' + escapeHtml(item.trust) + ' · ' + escapeHtml(item.method) + ' ' + escapeHtml(item.origin + item.path) + '</small></p>' +
        '<code>' + atomic(item.priceAtomic) + '</code>' +
      '</div>',
    ).join('');
    document.querySelector('#registry-count').textContent = data.resources.length + ' TRUSTED';
  } catch {
    container.innerHTML = '<p class="empty-state">Resource registry unavailable.</p>';
  }
}

async function loadAudit() {
  const suffix = activeJobId ? '?jobId=' + encodeURIComponent(activeJobId) : '';
  const container = document.querySelector('#audit-list');
  try {
    const response = await fetch('/api/shield/audit' + suffix);
    const data = await response.json();
    if (!data.events.length) {
      container.innerHTML = '<p class="empty-state">No events yet. Every quote, settlement, validation, and failure appears here.</p>';
      return;
    }
    container.innerHTML = data.events.slice().reverse().map(event => {
      const paid = event.paymentStatus === 'settled';
      return '<div class="audit-row">' +
        '<div><b>' + escapeHtml(event.event) + '</b><small>' + new Date(event.timestamp).toLocaleTimeString() + '</small></div>' +
        '<code>' + escapeHtml(event.resourceId || event.jobId) + '</code>' +
        '<b class="' + (paid ? 'paid' : event.errorCode ? 'failed' : '') + '">' + escapeHtml(event.paymentStatus || 'recorded') + '</b>' +
      '</div>';
    }).join('');
  } catch {
    container.innerHTML = '<p class="empty-state">Audit service unavailable.</p>';
  }
}

async function loadJob(jobId) {
  const response = await fetch('/api/shield/jobs/' + encodeURIComponent(jobId));
  if (!response.ok) return;
  const job = await response.json();
  if (job.signature) renderReceipt(job);
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  runButton.disabled = true;
  activeJobId = jobInput.value.trim() || makeJobId();
  jobInput.value = activeJobId;
  const request = makeRequest(activeJobId);
  setMessage('working', 'Validating trusted providers, inputs, and budget…', 'No payment challenge is created until policy passes.');
  setFlow('client', 'active');

  try {
    const response = await fetch('/api/shield/execute', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request)
    });
    const data = await response.json().catch(() => ({}));
    if (response.status !== 402) {
      if (response.ok && data.signature) {
        renderReceipt(data);
        setMessage('success', 'Cached signed receipt returned.', 'Idempotency prevented a duplicate payment.');
        return;
      }
      throw new Error(data.message || 'Expected HTTP 402, received ' + response.status + '.');
    }
    renderQuote(data.quote);
    setFlow('quote', 'active');
    setMessage('success', 'Policy passed. Bound x402 quote created.', demoReady
      ? 'The server-side disposable TestNet payer is settling this request now.'
      : 'Configure DEMO_MODE + disposable TestNet mnemonics or run pnpm client:shield to settle it.');

    if (demoReady) {
      setFlow('shield', 'active');
      const paid = await fetch('/demo/shield', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request)
      });
      const receipt = await paid.json().catch(() => ({}));
      if (!paid.ok) throw new Error(receipt.message || 'Paid demo returned HTTP ' + paid.status + '.');
      renderReceipt(receipt);
      setMessage('success', 'Settlement confirmed, downstream responses validated, receipt signed.', 'Only validated resource results are included below.');
    }
  } catch (error) {
    setMessage('error', 'Shield request stopped.', error instanceof Error ? error.message : String(error));
    setFlow('shield', 'failed');
  } finally {
    runButton.disabled = false;
    await loadAudit();
  }
});

document.querySelector('#refresh-audit').addEventListener('click', loadAudit);
jobInput.value = makeJobId();
loadRegistry();
loadAudit();
const queryJob = new URLSearchParams(location.search).get('job');
if (queryJob) { activeJobId = queryJob; jobInput.value = queryJob; loadJob(queryJob).then(loadAudit); }
`;
