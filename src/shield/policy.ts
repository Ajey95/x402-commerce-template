import type { ExecuteShieldRequest, ShieldConfig } from './types.js';
import type { ResourceRegistry } from './registry.js';
import { validateExactObject } from './input-validator.js';

export type PolicyResult =
  | { ok: true; totalMaxPaymentAtomic: number; quotedPriceAtomic: number }
  | { ok: false; code: string; message: string };

function reject(code: string, message: string): PolicyResult {
  return { ok: false, code, message };
}

export function evaluatePolicy(
  request: ExecuteShieldRequest,
  config: ShieldConfig,
  registry: ResourceRegistry,
): PolicyResult {
  if (request.resources.length < 1) return reject('no_resources', 'At least one resource is required.');
  if (request.resources.length > config.maxResources) {
    return reject('too_many_resources', `At most ${config.maxResources} resources are allowed.`);
  }

  const seen = new Set<string>();
  let totalMaxPaymentAtomic = 0;

  for (const resource of request.resources) {
    if (seen.has(resource.id)) {
      return reject('duplicate_resource', `Resource ${resource.id} appears more than once.`);
    }
    seen.add(resource.id);

    const definition = registry.get(resource.id);
    if (!definition) return reject('resource_not_allowed', `Resource ${resource.id} is not registered.`);

    const input = validateExactObject(resource.input, definition.inputSchema);
    if (!input.ok) return reject(input.code, input.reason);

    if (!Number.isSafeInteger(resource.maxPayment) || resource.maxPayment < 0) {
      return reject('invalid_resource_payment', 'Resource payment limits must be non-negative integers.');
    }
    if (resource.maxPayment > config.maxResourcePaymentAtomic) {
      return reject('resource_over_budget', `Resource ${resource.id} exceeds the configured payment limit.`);
    }
    if (definition.maxPriceAtomic !== undefined && definition.priceAtomic > definition.maxPriceAtomic) {
      return reject('provider_price_invalid', `Resource ${resource.id} exceeds its curated provider price ceiling.`);
    }
    if (definition.priceAtomic > resource.maxPayment) {
      return reject('resource_price_exceeds_limit', `Resource ${resource.id} price exceeds the request limit.`);
    }

    totalMaxPaymentAtomic += resource.maxPayment;
  }

  const quotedPriceAtomic = totalMaxPaymentAtomic + config.serviceFeeAtomic;
  if (quotedPriceAtomic > config.maxJobSpendAtomic) {
    return reject('job_over_budget', 'The quoted job price exceeds SHIELD_MAX_JOB_SPEND.');
  }

  return { ok: true, totalMaxPaymentAtomic, quotedPriceAtomic };
}
