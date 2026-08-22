import algosdk from 'algosdk';
import type { Account } from 'algosdk';
import type { ShieldReceipt } from './types.js';

export type UnsignedReceipt = Omit<ShieldReceipt, 'receiptPublicKey' | 'signature'>;

export interface ReceiptSigner {
  readonly publicKey: string;
  sign(receipt: UnsignedReceipt): ShieldReceipt;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function signingBytes(receipt: UnsignedReceipt): Uint8Array {
  return new TextEncoder().encode(stableJson(receipt));
}

export function createReceiptSigner(account: Account): ReceiptSigner {
  const publicKey = account.addr.toString();
  return {
    publicKey,
    sign(receipt) {
      const signature = algosdk.signBytes(signingBytes(receipt), account.sk);
      return {
        ...receipt,
        receiptPublicKey: publicKey,
        signature: Buffer.from(signature).toString('base64url'),
      };
    },
  };
}

export function createReceiptSignerFromMnemonic(mnemonic: string): ReceiptSigner {
  try {
    return createReceiptSigner(algosdk.mnemonicToSecretKey(mnemonic));
  } catch {
    throw new Error('TREASURY_MNEMONIC must be a valid 25-word Algorand mnemonic.');
  }
}

export function verifyReceipt(receipt: ShieldReceipt): boolean {
  try {
    const { receiptPublicKey, signature, ...unsigned } = receipt;
    return algosdk.verifyBytes(
      signingBytes(unsigned),
      Buffer.from(signature, 'base64url'),
      receiptPublicKey,
    );
  } catch {
    return false;
  }
}

