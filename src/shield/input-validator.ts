import type { JsonObjectSchema } from './types.js';

export type InputValidationResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; code: 'invalid_resource_input'; reason: string };

function rejected(reason: string): InputValidationResult {
  return { ok: false, code: 'invalid_resource_input', reason };
}

function fieldPath(parent: string, key: string): string {
  return parent ? `${parent}.${key}` : key;
}

function validateObject(input: unknown, schema: JsonObjectSchema, path = ''): InputValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return path
      ? rejected(`Resource input field ${path} must be object.`)
      : rejected('Resource input must be a JSON object.');
  }

  const record = input as Record<string, unknown>;
  const allowed = new Set(Object.keys(schema.properties));

  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      return rejected(`Unexpected resource input field: ${fieldPath(path, key)}.`);
    }
  }

  for (const key of schema.required) {
    if (!(key in record)) {
      return rejected(`Missing resource input field: ${fieldPath(path, key)}.`);
    }
  }

  for (const [key, property] of Object.entries(schema.properties)) {
    const value = record[key];
    const currentPath = fieldPath(path, key);
    if (value === undefined && !schema.required.includes(key)) continue;
    if (property.type === 'object') {
      const nestedResult = validateObject(value, property, currentPath);
      if (!nestedResult.ok) return nestedResult;
      continue;
    }
    if (typeof value !== property.type) {
      return rejected(`Resource input field ${currentPath} must be ${property.type}.`);
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return rejected(`Resource input field ${currentPath} must be finite.`);
    }
    if (typeof value === 'string') {
      if (!value.trim()) return rejected(`Resource input field ${currentPath} must not be empty.`);
      if (property.maxLength !== undefined && value.length > property.maxLength) {
        return rejected(
          `Resource input field ${currentPath} exceeds ${property.maxLength} characters.`,
        );
      }
      if (property.enum !== undefined && !property.enum.includes(value)) {
        return rejected(
          `Resource input field ${currentPath} must be one of: ${property.enum.join(', ')}.`,
        );
      }
    }
    if (property.const !== undefined && !Object.is(value, property.const)) {
      return rejected(`Resource input field ${currentPath} does not match the trusted constant.`);
    }
  }

  return { ok: true, data: structuredClone(record) };
}

export function validateExactObject(input: unknown, schema: JsonObjectSchema): InputValidationResult {
  return validateObject(input, schema);
}
