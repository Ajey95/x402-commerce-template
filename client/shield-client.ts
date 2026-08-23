import type { ExecuteShieldRequest, ShieldReceipt } from '../src/shield/types.js';
import type { AlgorandNetwork } from '../src/config.js';

export function createDemoShieldRequest(
  _baseUrl: string,
  requestId: string,
  networkName: AlgorandNetwork = 'testnet',
): ExecuteShieldRequest {
  const external = networkName === 'testnet'
    ? { id: 'external-algo-price', input: {} }
    : { id: 'external-hash', input: { text: 'CPMM-SHIELD', algo: 'sha256' } };
  return {
    requestId,
    resources: [
      {
        id: 'weather',
        input: { city: 'Bangalore' },
        maxPayment: 2_000,
        required: true,
      },
      {
        id: 'company-lookup',
        input: { name: 'Algorand Foundation' },
        maxPayment: 3_000,
        required: true,
      },
      {
        ...external,
        maxPayment: 1_000,
        required: true,
      },
    ],
  };
}

export interface ShieldPayer {
  fetchWithPayment(input: string | URL | Request, init?: RequestInit): Promise<Response>;
  readSettlement(response: Response): { success: boolean; transaction?: string };
}

export interface ShieldClientResult {
  receipt: ShieldReceipt;
  transaction: string;
  quote: unknown;
}

function post(request: ExecuteShieldRequest): RequestInit {
  return {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(request),
  };
}

async function paymentFailure(response: Response): Promise<string> {
  const encoded = response.headers.get('payment-required') ?? response.headers.get('x-payment-required');
  if (encoded) {
    try {
      const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
        error?: string;
        errorReason?: string;
        errorMessage?: string;
      };
      const reason = decoded.errorMessage ?? decoded.errorReason ?? decoded.error;
      if (reason) return reason;
    } catch {
      // Fall through to the safe JSON response message.
    }
  }
  const text = await response.text();
  try {
    const body = JSON.parse(text) as { message?: string; error?: string };
    return body.message ?? body.error ?? `HTTP ${response.status}`;
  } catch {
    return text || `HTTP ${response.status}`;
  }
}

export async function requestShieldJobWithProof(
  baseUrl: string,
  request: ExecuteShieldRequest,
  payer: ShieldPayer,
  fetchImpl: typeof fetch = fetch,
): Promise<ShieldClientResult> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/shield/execute`;
  const unpaid = await fetchImpl(url, post(request));
  const challenge = await unpaid.json().catch(() => ({}));
  if (unpaid.status !== 402) {
    if (unpaid.ok && typeof challenge === 'object' && challenge) {
      return { receipt: challenge as ShieldReceipt, transaction: 'cached', quote: undefined };
    }
    throw new Error(`Shield discovery expected HTTP 402, received ${unpaid.status}.`);
  }

  const paid = await payer.fetchWithPayment(url, post(request));
  if (!paid.ok) throw new Error(`Shield payment returned HTTP ${paid.status}: ${await paymentFailure(paid)}`);
  const settlement = payer.readSettlement(paid);
  if (!settlement.success || !settlement.transaction) {
    throw new Error('The shield response arrived, but upstream settlement was not confirmed.');
  }
  return {
    receipt: (await paid.json()) as ShieldReceipt,
    transaction: settlement.transaction,
    quote: (challenge as { quote?: unknown }).quote,
  };
}

export async function requestShieldJob(
  baseUrl: string,
  request: ExecuteShieldRequest,
  payer: ShieldPayer,
  fetchImpl: typeof fetch = fetch,
): Promise<ShieldReceipt> {
  return (await requestShieldJobWithProof(baseUrl, request, payer, fetchImpl)).receipt;
}
