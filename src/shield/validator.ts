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

function fieldPath(parent: string, key: string): string {
  return parent ? `${parent}.${key}` : key;
}

function validateObject(body: unknown, schema: JsonObjectSchema, path = ''): ValidationResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return path
      ? rejected('wrong_type', `Response field ${path} must be object.`)
      : rejected('invalid_shape', 'Response must be a JSON object.');
  }
  const record = body as Record<string, unknown>;
  const allowed = new Set(Object.keys(schema.properties));
  for (const key of Object.keys(record)) {
    const currentPath = fieldPath(path, key);
    if (!allowed.has(key)) {
      return rejected('extra_field', `Unexpected response field: ${currentPath}.`);
    }
  }
  for (const key of schema.required) {
    if (!(key in record)) {
      return rejected('missing_field', `Missing required response field: ${fieldPath(path, key)}.`);
    }
  }
  for (const [key, property] of Object.entries(schema.properties)) {
    const value = record[key];
    const currentPath = fieldPath(path, key);
    if (property.type === 'object') {
      const nestedResult = validateObject(value, property, currentPath);
      if (!nestedResult.ok) return nestedResult;
      continue;
    }
    if (typeof value !== property.type) {
      return rejected('wrong_type', `Response field ${currentPath} must be ${property.type}.`);
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return rejected('wrong_type', `Response field ${currentPath} must be a finite number.`);
    }
    if (typeof value === 'string') {
      if (property.maxLength !== undefined && value.length > property.maxLength) {
        return rejected(
          'string_too_long',
          `Response field ${currentPath} exceeds ${property.maxLength} characters.`,
        );
      }
      if (INJECTION_PATTERNS.some(pattern => pattern.test(value))) {
        return rejected(
          'prompt_injection_marker',
          `Response field ${currentPath} contains a blocked instruction marker.`,
        );
      }
      if (property.enum !== undefined && !property.enum.includes(value)) {
        return rejected('enum_mismatch', `Response field ${currentPath} is not an allowed value.`);
      }
    }
    if (property.const !== undefined && !Object.is(value, property.const)) {
      return rejected(
        'const_mismatch',
        `Response field ${currentPath} does not match the trusted constant.`,
      );
    }
  }
  return { ok: true, data: structuredClone(record) };
}

export function validateResourceResponse(body: unknown, schema: JsonObjectSchema): ValidationResult {
  return validateObject(body, schema);
}

