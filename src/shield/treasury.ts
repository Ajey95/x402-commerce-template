import type { PaymentPolicy } from '@x402/fetch';
import type { RuntimeConfig } from '../config.js';
import { createAvmPayingClient } from '../x402/client.js';
import { buildProviderRequest } from './provider-request.js';
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

/**
 * Filters a downstream provider's advertised 402 requirements before a transaction is signed.
 * The treasury will pay only the configured Algorand network, configured USDC asset, and exact
 * trusted resource price. Owned demo resources are also pinned to the shield receiver; curated
 * external providers may optionally pin an expected recipient in their ResourceDefinition.
 */
export function createDownstreamPaymentPolicy(
  config: Pick<RuntimeConfig, 'network' | 'usdcAssetId' | 'payTo'>,
  definition: ResourceDefinition,
): PaymentPolicy {
  const expectedPayTo = definition.trust === 'owned-demo' ? config.payTo : definition.payTo;
  return (_version, requirements) =>
    requirements.filter(requirement => {
      const avm = requirement as typeof requirement & { asset?: string | number };
      return (
        requirement.scheme === 'exact' &&
        requirement.network === config.network &&
        String(requirement.amount) === String(definition.priceAtomic) &&
        String(avm.asset ?? '') === String(config.usdcAssetId) &&
        (!expectedPayTo || requirement.payTo === expectedPayTo)
      );
    });
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
      const built = buildProviderRequest(request, definition, options.timeoutMs);
      let response: Response;
      try {
        response = await payer.fetchWithPayment(built.url, built.init);
      } catch (error) {
        const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
        const message = error instanceof Error ? error.message.toLowerCase() : '';
        const paymentRejected = !timedOut && (message.includes('payment') || message.includes('requirement'));
        throw new ResourceCallError(
          timedOut ? 'downstream_timeout' : paymentRejected ? 'downstream_payment_rejected' : 'downstream_unavailable',
          timedOut
            ? 'The downstream resource timed out.'
            : paymentRejected
              ? 'The downstream payment challenge did not match trusted policy.'
              : 'The downstream resource could not be reached.',
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

      const maxResponseBytes = definition.maxResponseBytes ?? options.maxResponseBytes;
      const declaredLength = Number(response.headers.get('content-length') ?? 0);
      if (declaredLength > maxResponseBytes) {
        throw new ResourceCallError('response_too_large', 'Downstream response exceeds the size limit.', settled);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > maxResponseBytes) {
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

  // Resolve and expose the treasury address once; each resource call receives its own x402 client
  // so its pre-sign payment policy is immutable and safe under concurrent jobs.
  const identity = createAvmPayingClient(config.treasuryMnemonic, config.networkName, fetchImpl);
  const address = identity.signer.address;

  const client: ResourceClient = {
    async execute(request, definition, jobId) {
      const payingClient = createAvmPayingClient(config.treasuryMnemonic!, config.networkName, fetchImpl, {
        paymentPolicies: [createDownstreamPaymentPolicy(config, definition)],
      });
      const payer: PaidFetchClient = {
        address: payingClient.signer.address,
        fetchWithPayment: payingClient.fetchWithPayment,
        readSettlement: response =>
          payingClient.httpClient.getPaymentSettleResponse(name => response.headers.get(name)),
      };
      return createPaidResourceClient(payer, {
        timeoutMs: config.shield.requestTimeoutMs,
        maxResponseBytes: config.shield.maxResponseBytes,
      }).execute(request, definition, jobId);
    },
  };

  return { address, client };
}
