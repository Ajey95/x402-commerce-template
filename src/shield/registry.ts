import type { ResourceDefinition } from './types.js';

export type ResourceRegistry = ReadonlyMap<string, ResourceDefinition>;

function assertDefinition(definition: ResourceDefinition): void {
  const origin = new URL(definition.origin);
  if (origin.protocol !== 'http:' && origin.protocol !== 'https:') {
    throw new Error(`Resource ${definition.id} must use an HTTP or HTTPS origin.`);
  }
  if (origin.username || origin.password) {
    throw new Error(`Resource ${definition.id} origin must not contain credentials.`);
  }
  if (!definition.path.startsWith('/')) {
    throw new Error(`Resource ${definition.id} path must start with '/'.`);
  }
  if (!Number.isSafeInteger(definition.priceAtomic) || definition.priceAtomic < 0) {
    throw new Error(`Resource ${definition.id} priceAtomic must be a non-negative safe integer.`);
  }
}

function ownedDefinitions(baseUrl: string): ResourceDefinition[] {
  const origin = new URL(baseUrl).origin;
  return [
    {
      id: 'weather',
      name: 'Weather',
      origin,
      method: 'GET',
      path: '/api/resources/weather',
      priceAtomic: 2_000,
      inputSchema: {
        type: 'object',
        required: ['city'],
        additionalProperties: false,
        properties: { city: { type: 'string', maxLength: 80 } },
      },
      responseSchema: {
        type: 'object',
        required: ['city', 'temperature', 'condition', 'humidity', 'simulated', 'generatedAt'],
        additionalProperties: false,
        properties: {
          city: { type: 'string', maxLength: 80 },
          temperature: { type: 'number' },
          condition: { type: 'string', maxLength: 80 },
          humidity: { type: 'number' },
          simulated: { type: 'boolean' },
          generatedAt: { type: 'string', maxLength: 40 },
        },
      },
      trust: 'owned-demo',
      description: 'Deterministic simulated weather content behind a real x402 payment boundary.',
      tags: ['cpmm-shield', 'weather', 'algorand', 'x402', 'simulated-content'],
    },
    {
      id: 'company-lookup',
      name: 'Company Lookup',
      origin,
      method: 'GET',
      path: '/api/resources/company-lookup',
      priceAtomic: 3_000,
      inputSchema: {
        type: 'object',
        required: ['name'],
        additionalProperties: false,
        properties: { name: { type: 'string', maxLength: 120 } },
      },
      responseSchema: {
        type: 'object',
        required: ['name', 'founded', 'industry', 'headquarters', 'status', 'simulated'],
        additionalProperties: false,
        properties: {
          name: { type: 'string', maxLength: 120 },
          founded: { type: 'number' },
          industry: { type: 'string', maxLength: 100 },
          headquarters: { type: 'string', maxLength: 120 },
          status: { type: 'string', maxLength: 40 },
          simulated: { type: 'boolean' },
        },
      },
      trust: 'owned-demo',
      description: 'Deterministic simulated company information behind a real x402 payment boundary.',
      tags: ['cpmm-shield', 'company-data', 'algorand', 'x402', 'simulated-content'],
    },
    {
      id: 'sentiment-score',
      name: 'Sentiment Score',
      origin,
      method: 'POST',
      path: '/api/resources/sentiment-score',
      priceAtomic: 2_000,
      inputSchema: {
        type: 'object',
        required: ['text'],
        additionalProperties: false,
        properties: { text: { type: 'string', maxLength: 5_000 } },
      },
      responseSchema: {
        type: 'object',
        required: ['score', 'label', 'confidence', 'simulated'],
        additionalProperties: false,
        properties: {
          score: { type: 'number' },
          label: { type: 'string', maxLength: 40 },
          confidence: { type: 'number' },
          simulated: { type: 'boolean' },
        },
      },
      trust: 'owned-demo',
      description: 'Deterministic sentiment scoring behind a real x402 payment boundary.',
      tags: ['cpmm-shield', 'sentiment', 'algorand', 'x402', 'simulated-content'],
    },
  ];
}

export function createResourceRegistry(
  baseUrl: string,
  external: ResourceDefinition[] = [],
): ResourceRegistry {
  const map = new Map<string, ResourceDefinition>();
  for (const definition of [...ownedDefinitions(baseUrl), ...external]) {
    assertDefinition(definition);
    if (map.has(definition.id)) throw new Error(`Duplicate resource id: ${definition.id}.`);
    map.set(definition.id, Object.freeze({ ...definition, tags: [...definition.tags] }));
  }
  return map;
}
