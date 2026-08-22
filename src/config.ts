import algosdk from 'algosdk';
import {
  ALGORAND_MAINNET_CAIP2,
  ALGORAND_TESTNET_CAIP2,
  USDC_MAINNET_ASA_ID,
  USDC_TESTNET_ASA_ID,
} from '@x402/avm';
import type { ShieldConfig } from './shield/types.js';

export type AlgorandNetwork = 'testnet' | 'mainnet';

export interface RuntimeConfig {
  port: number;
  networkName: AlgorandNetwork;
  network: `${string}:${string}`;
  usdcAssetId: string;
  indexerUrl: string;
  facilitatorUrl: string;
  payTo: string;
  price: string;
  challengeMode: boolean;
  demoMode: boolean;
  demoMnemonic?: string;
  defaultWalletAddress: string;
  treasuryMnemonic?: string;
  openaiApiKey?: string;
  openaiModel: string;
  shield: ShieldConfig;
}

const NETWORKS = {
  testnet: {
    network: ALGORAND_TESTNET_CAIP2,
    usdcAssetId: USDC_TESTNET_ASA_ID,
    indexerUrl: 'https://testnet-idx.algonode.cloud',
  },
  mainnet: {
    network: ALGORAND_MAINNET_CAIP2,
    usdcAssetId: USDC_MAINNET_ASA_ID,
    indexerUrl: 'https://mainnet-idx.algonode.cloud',
  },
} as const;

function positiveInteger(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const value = Number(env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function usdToAtomic(value: string): number {
  const parsed = Number(value.trim().replace(/^\$/, ''));
  const atomic = Math.round(parsed * 1_000_000);
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isSafeInteger(atomic)) {
    throw new Error('PRICE_USDC must be a non-negative USD amount such as $0.001.');
  }
  return atomic;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const networkName = env.ALGORAND_NETWORK ?? 'testnet';
  if (networkName !== 'testnet' && networkName !== 'mainnet') {
    throw new Error('ALGORAND_NETWORK must be either "testnet" or "mainnet".');
  }

  const payTo = env.PAY_TO_ADDRESS?.trim();
  if (!payTo) {
    throw new Error('PAY_TO_ADDRESS is required. Add the public address of the wallet receiving USDC.');
  }
  if (!algosdk.isValidAddress(payTo)) {
    throw new Error('PAY_TO_ADDRESS is not a valid Algorand address.');
  }

  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const selected = NETWORKS[networkName];
  const defaultWalletAddress = env.WALLET_ADDRESS?.trim() || payTo;
  if (!algosdk.isValidAddress(defaultWalletAddress)) {
    throw new Error('WALLET_ADDRESS is not a valid Algorand address.');
  }

  const demoMode = env.DEMO_MODE === 'true';
  if (demoMode && networkName !== 'testnet') {
    throw new Error('DEMO_MODE is TestNet-only. Disable it before using MainNet.');
  }

  const apiBaseUrl = (env.API_BASE_URL ?? `http://localhost:${port}`).replace(/\/$/, '');
  try {
    const parsed = new URL(apiBaseUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error();
  } catch {
    throw new Error('API_BASE_URL must be an absolute HTTP or HTTPS URL.');
  }

  const price = env.PRICE_USDC ?? '$0.001';
  const shield: ShieldConfig = {
    maxJobSpendAtomic: positiveInteger(env, 'SHIELD_MAX_JOB_SPEND', 20_000),
    maxResourcePaymentAtomic: positiveInteger(env, 'SHIELD_MAX_RESOURCE_PAYMENT', 10_000),
    maxResources: positiveInteger(env, 'SHIELD_MAX_RESOURCES', 3),
    requestTimeoutMs: positiveInteger(env, 'SHIELD_REQUEST_TIMEOUT_MS', 8_000),
    maxResponseBytes: positiveInteger(env, 'SHIELD_MAX_RESPONSE_BYTES', 64_000),
    quoteExpirySeconds: positiveInteger(env, 'QUOTE_EXPIRY_SECONDS', 120),
    serviceFeeAtomic: usdToAtomic(price),
    demoMode,
    baseUrl: apiBaseUrl,
  };

  return {
    port,
    networkName,
    network: selected.network,
    usdcAssetId: selected.usdcAssetId,
    indexerUrl: (env.INDEXER_URL ?? selected.indexerUrl).replace(/\/$/, ''),
    facilitatorUrl: (env.FACILITATOR_URL ?? 'https://facilitator.goplausible.xyz').replace(/\/$/, ''),
    payTo,
    price,
    challengeMode: env.CHALLENGE_MODE === 'true',
    demoMode,
    demoMnemonic: demoMode ? env.CLIENT_MNEMONIC?.trim() : undefined,
    defaultWalletAddress,
    treasuryMnemonic: env.TREASURY_MNEMONIC?.trim() || undefined,
    openaiApiKey: env.OPENAI_API_KEY?.trim() || undefined,
    openaiModel: env.OPENAI_MODEL?.trim() || 'gpt-5.6',
    shield,
  };
}
