import type { RuntimeConfig } from '../config.js';
import { createAvmPayingClient } from '../x402/client.js';
import { ResourceCallError, type ResourceCallResult, type ResourceClient } from './resource-client.js';
import type { ResourceDefinition, RequestedResource } from './types.js';

export interface PaidFetchClient {
  address: string;
  fetchWithPayment(input: string | URL | Request, init?: RequestInit): Promise<Response>;
  readSettlement(response: Response): { success: boolean; transaction?: string };
}

export interface PaidResourceClientOptions {
  timeoutMs: number;
  maxResponseBytes: number;
}

function callUrl(request: RequestedResource, definition: ResourceDefinition): string {
  const url = new URL(request.url);
  if (definition.id === 'weather') url.searchParams.set('city', 'Bangalore');
  if (definition.id === 'company-lookup') url.searchParams.set('name', 'Algorand Foundation');
  return url.toString();
}

function requestInit(definition: ResourceDefinition, timeoutMs: number): RequestInit {
  const base: RequestInit = {
    method: definition.method,
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: 'application/json' },
  };
  if (definition.method === 'POST') {
    return {
      ...base,
      headers: { ...base.headers, 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Algorand enables secure, scalable agentic payments.' }),
    };
  }
  return base;
}

export function createPaidResourceClient(
  payer: PaidFetchClient,
  options: PaidResourceClientOptions,
): ResourceClient {
  return {
    async execute(
      request: RequestedResource,
      definition: ResourceDefinition,
      _jobId?: string,
    ): Promise<ResourceCallResult> {
      const started = Date.now();
      let response: Response;
      try {
        response = await payer.fetchWithPayment(
          callUrl(request, definition),
          requestInit(definition, options.timeoutMs),
        );
      } catch (error) {
        const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
        throw new ResourceCallError(
          timedOut ? 'downstream_timeout' : 'downstream_unavailable',
          timedOut ? 'The downstream resource timed out.' : 'The downstream resource could not be reached.',
          { paymentStatus: 'failed', durationMs: Date.now() - started },
        );
      }

      const durationMs = Date.now() - started;
      if (response.status >= 300 && response.status < 400) {
        throw new ResourceCallError('redirect_rejected', 'Downstream redirects are not allowed.', {
          paymentStatus: 'failed',
          durationMs,
          status: response.status,
        });
      }
      if (!response.ok) {
        throw new ResourceCallError('downstream_http_error', `Downstream returned HTTP ${response.status}.`, {
          paymentStatus: 'failed',
          durationMs,
          status: response.status,
        });
      }

      const settlement = payer.readSettlement(response);
      if (!settlement.success || !settlement.transaction) {
        throw new ResourceCallError('settlement_unconfirmed', 'Downstream settlement was not confirmed.', {
          paymentStatus: 'failed',
          durationMs,
          status: response.status,
        });
      }

      const settled = {
        paymentStatus: 'settled' as const,
        durationMs,
        status: response.status,
        transaction: settlement.transaction,
        amountAtomic: definition.priceAtomic,
      };
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.toLowerCase().includes('application/json')) {
        throw new ResourceCallError('invalid_content_type', 'Downstream response must be JSON.', settled);
      }
      const declaredLength = Number(response.headers.get('content-length') ?? 0);
      if (declaredLength > options.maxResponseBytes) {
        throw new ResourceCallError('response_too_large', 'Downstream response exceeds the size limit.', settled);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > options.maxResponseBytes) {
        throw new ResourceCallError('response_too_large', 'Downstream response exceeds the size limit.', settled);
      }
      let data: unknown;
      try {
        data = JSON.parse(new TextDecoder().decode(bytes));
      } catch {
        throw new ResourceCallError('invalid_json', 'Downstream returned malformed JSON.', settled);
      }
      return {
        status: response.status,
        transaction: settlement.transaction,
        amountAtomic: definition.priceAtomic,
        durationMs,
        data,
      };
    },
  };
}

export function createTreasuryResourceClient(
  config: RuntimeConfig,
  fetchImpl: typeof fetch = fetch,
): { address: string; client: ResourceClient } {
  if (!config.treasuryMnemonic) {
    throw new Error('TREASURY_MNEMONIC is required to pay downstream x402 resources.');
  }
  const payingClient = createAvmPayingClient(config.treasuryMnemonic, config.networkName, fetchImpl);
  const payer: PaidFetchClient = {
    address: payingClient.signer.address,
    fetchWithPayment: payingClient.fetchWithPayment,
    readSettlement: response =>
      payingClient.httpClient.getPaymentSettleResponse(name => response.headers.get(name)),
  };
  return {
    address: payer.address,
    client: createPaidResourceClient(payer, {
      timeoutMs: config.shield.requestTimeoutMs,
      maxResponseBytes: config.shield.maxResponseBytes,
    }),
  };
}

