import algosdk from 'algosdk';
import { ALGORAND_MAINNET_CAIP2, ALGORAND_TESTNET_CAIP2 } from '@x402/avm';
import { createAvmPayingClient } from '../src/x402/client.js';

export type ClientNetwork = 'testnet' | 'mainnet';

export function resourceUrl(): string {
  const baseUrl = (process.env.API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const address = process.env.WALLET_ADDRESS ?? process.env.PAY_TO_ADDRESS;
  if (!address || !algosdk.isValidAddress(address)) {
    throw new Error('Set WALLET_ADDRESS (or PAY_TO_ADDRESS) to a valid Algorand address in .env.');
  }
  return `${baseUrl}/api/wallet/${address}`;
}

export function clientNetwork(): { name: ClientNetwork; caip2: `${string}:${string}` } {
  const name = process.env.ALGORAND_NETWORK ?? 'testnet';
  if (name === 'testnet') return { name, caip2: ALGORAND_TESTNET_CAIP2 };
  if (name === 'mainnet') return { name, caip2: ALGORAND_MAINNET_CAIP2 };
  throw new Error('ALGORAND_NETWORK must be either "testnet" or "mainnet".');
}

export function createPayingClient() {
  const mnemonic = process.env.CLIENT_MNEMONIC?.trim();
  if (!mnemonic) {
    throw new Error(
      'CLIENT_MNEMONIC is missing. Use only a disposable demo wallet, funded with ALGO and opted into USDC.',
    );
  }

  const network = clientNetwork();
  const payingClient = createAvmPayingClient(mnemonic, network.name);

  return {
    signer: payingClient.signer,
    network,
    fetchWithPayment: payingClient.fetchWithPayment,
    httpClient: payingClient.httpClient,
  };
}

export interface PaymentRequiredSummary {
  price: string;
  network: string;
  asset: string;
  description: string;
}

export function readPaymentRequired(response: Response): PaymentRequiredSummary | null {
  const encoded = response.headers.get('payment-required');
  if (!encoded) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
      resource?: { description?: string };
      accepts?: Array<{
        amount?: string;
        network?: string;
        asset?: string;
        extra?: { asset?: string | number; name?: string; decimals?: number };
      }>;
    };
    const requirement = parsed.accepts?.[0];
    const decimals = requirement?.extra?.decimals ?? 6;
    const rawAmount = requirement?.amount ? Number(requirement.amount) : Number.NaN;
    const price = Number.isFinite(rawAmount) ? `$${rawAmount / 10 ** decimals}` : 'See payment requirements';

    return {
      price,
      network: requirement?.network ?? 'unknown',
      asset: String(requirement?.asset ?? requirement?.extra?.asset ?? requirement?.extra?.name ?? 'unknown'),
      description: parsed.resource?.description ?? 'Paid x402 resource',
    };
  } catch {
    return null;
  }
}

export function explainPaymentError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes('opt') && lower.includes('asset')) {
    return `${message}\nThe payer may not be opted into the configured USDC asset.`;
  }
  if (lower.includes('insufficient') || lower.includes('overspend')) {
    return `${message}\nFund the payer with enough ALGO for fees/minimum balance and enough USDC for the request.`;
  }
  if (lower.includes('fetch') || lower.includes('network')) {
    return `${message}\nCheck that CPMM-SHIELD and the GoPlausible facilitator are reachable.`;
  }
  return message;
}
