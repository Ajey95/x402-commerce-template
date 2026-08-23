import type { AlgorandNetwork } from '../src/config.js';

function resourceVariant(id: string, input: Record<string, unknown>) {
  return {
    type: 'object',
    properties: {
      id: { type: 'string', enum: [id] },
      input,
      maxPayment: { type: 'integer', minimum: 0, maximum: 10_000 },
      required: { type: 'boolean' },
    },
    required: ['id', 'input', 'maxPayment', 'required'],
    additionalProperties: false,
  };
}

function exactInput(properties: Record<string, unknown>, required: string[]) {
  return { type: 'object', properties, required, additionalProperties: false };
}

export function createShieldTool(networkName: AlgorandNetwork) {
  const external = networkName === 'testnet'
    ? resourceVariant('external-algo-price', exactInput({}, []))
    : resourceVariant('external-hash', exactInput({
      text: { type: 'string', maxLength: 5_000 },
      algo: { type: 'string', maxLength: 8, enum: ['sha256', 'sha512', 'sha1', 'md5'] },
    }, ['text', 'algo']));

  return {
    type: 'function',
    name: 'requestShieldJob',
    description:
      'Buy one bounded CPMM-SHIELD job using only trusted resources. Never invent provider URLs, recipients, schemas, networks, or assets.',
    strict: false,
    parameters: {
      type: 'object',
      properties: {
        resources: {
          type: 'array',
          minItems: 1,
          maxItems: 3,
          items: {
            anyOf: [
              resourceVariant('weather', exactInput({ city: { type: 'string', maxLength: 80 } }, ['city'])),
              resourceVariant('company-lookup', exactInput({ name: { type: 'string', maxLength: 120 } }, ['name'])),
              resourceVariant('sentiment-score', exactInput({ text: { type: 'string', maxLength: 5_000 } }, ['text'])),
              external,
            ],
          },
        },
      },
      required: ['resources'],
      additionalProperties: false,
    },
  };
}

export function createShieldToolInstructions(networkName: AlgorandNetwork): string {
  const external = networkName === 'testnet'
    ? 'external-algo-price input is the exact empty object {}.'
    : 'external-hash input is exactly {text, algo}; use {text: "CPMM-SHIELD", algo: "sha256"} for the deterministic demo.';
  return `You are a commerce agent using CPMM-SHIELD as a payment firewall. Use requestShieldJob at most once. Choose only listed trusted resource IDs. Weather input is {city}; company-lookup input is {name}; sentiment-score input is {text}; ${external} Never invent URLs, payment recipients, schemas, networks, assets, or wallet credentials. After the tool result, summarize only validated results from the signed receipt.`;
}
