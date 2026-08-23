import type { JsonObjectSchema } from './types.js';

export type InputValidationResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; code: 'invalid_resource_input'; reason: string };

function rejected(reason: string): InputValidationResult {
  return { ok: false, code: 'invalid_resource_input', reason };
}

export function validateExactObject(input: unknown, schema: JsonObjectSchema): InputValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return rejected('Resource input must be a JSON object.');
  }

  const record = input as Record<string, unknown>;
  const allowed = new Set(Object.keys(schema.properties));

  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) return rejected(`Unexpected resource input field: ${key}.`);
  }

  for (const key of schema.required) {
    if (!(key in record)) return rejected(`Missing resource input field: ${key}.`);
  }

  for (const [key, property] of Object.entries(schema.properties)) {
    const value = record[key];
    if (value === undefined && !schema.required.includes(key)) continue;
    if (typeof value !== property.type) {
      return rejected(`Resource input field ${key} must be ${property.type}.`);
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return rejected(`Resource input field ${key} must be finite.`);
    }
    if (typeof value === 'string') {
      if (!value.trim()) return rejected(`Resource input field ${key} must not be empty.`);
      if (property.maxLength !== undefined && value.length > property.maxLength) {
        return rejected(`Resource input field ${key} exceeds ${property.maxLength} characters.`);
      }
    }
  }

  return { ok: true, data: structuredClone(record) };
}
