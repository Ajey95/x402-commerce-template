import type { ResourceDefinition } from './types.js';

export type ResourceRegistry = ReadonlyMap<string, ResourceDefinition>;

export function createResourceRegistry(_baseUrl: string): ResourceRegistry {
  return new Map<string, ResourceDefinition>([
    [
      'weather',
      {
        id: 'weather',
        method: 'GET',
        path: '/api/resources/weather',
        priceAtomic: 2_000,
        schema: {
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
      },
    ],
    [
      'company-lookup',
      {
        id: 'company-lookup',
        method: 'GET',
        path: '/api/resources/company-lookup',
        priceAtomic: 3_000,
        schema: {
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
      },
    ],
    [
      'sentiment-score',
      {
        id: 'sentiment-score',
        method: 'POST',
        path: '/api/resources/sentiment-score',
        priceAtomic: 2_000,
        schema: {
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
      },
    ],
  ]);
}

