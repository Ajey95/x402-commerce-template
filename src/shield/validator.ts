import type { JsonObjectSchema } from './types.js';

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /(^|\s)system\s*:/i,
  /you\s+are\s+now/i,
];

export type ValidationResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; code: string; reason: string };

function rejected(code: string, reason: string): ValidationResult {
  return { ok: false, code, reason };
}

export function validateResourceResponse(body: unknown, schema: JsonObjectSchema): ValidationResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return rejected('invalid_shape', 'Response must be a JSON object.');
  }
  const record = body as Record<string, unknown>;
  const allowed = new Set(Object.keys(schema.properties));
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) return rejected('extra_field', `Unexpected response field: ${key}.`);
  }
  for (const key of schema.required) {
    if (!(key in record)) return rejected('missing_field', `Missing required response field: ${key}.`);
  }
  for (const [key, property] of Object.entries(schema.properties)) {
    const value = record[key];
    if (typeof value !== property.type) {
      return rejected('wrong_type', `Response field ${key} must be ${property.type}.`);
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return rejected('wrong_type', `Response field ${key} must be a finite number.`);
    }
    if (typeof value === 'string') {
      if (property.maxLength !== undefined && value.length > property.maxLength) {
        return rejected('string_too_long', `Response field ${key} exceeds ${property.maxLength} characters.`);
      }
      if (INJECTION_PATTERNS.some(pattern => pattern.test(value))) {
        return rejected('prompt_injection_marker', `Response field ${key} contains a blocked instruction marker.`);
      }
    }
  }
  return { ok: true, data: structuredClone(record) };
}

