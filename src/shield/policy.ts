import type {
  ExecuteShieldRequest,
  ResourceDefinition,
  ShieldConfig,
} from './types.js';
import type { ResourceRegistry } from './registry.js';

export type PolicyResult =
  | { ok: true; totalMaxPaymentAtomic: number; quotedPriceAtomic: number }
  | { ok: false; code: string; message: string };

function reject(code: string, message: string): PolicyResult {
  return { ok: false, code, message };
}

function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (normalized === 'localhost' || normalized === '::1' || normalized === '0.0.0.0') return true;
  if (/^127\./.test(normalized) || /^10\./.test(normalized) || /^192\.168\./.test(normalized)) return true;
  const match = /^172\.(\d+)\./.exec(normalized);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

function matchesDefinition(
  url: URL,
  definition: ResourceDefinition,
  config: ShieldConfig,
): boolean {
  const base = new URL(config.baseUrl);
  return url.origin === base.origin && url.pathname === definition.path && !url.username && !url.password;
}

export function evaluatePolicy(
  request: ExecuteShieldRequest,
  config: ShieldConfig,
  registry: ResourceRegistry,
): PolicyResult {
  const configuredHostIsPrivate = isPrivateHostname(new URL(config.baseUrl).hostname);
  if (request.resources.length < 1) return reject('no_resources', 'At least one resource is required.');
  if (request.resources.length > config.maxResources) {
    return reject('too_many_resources', `At most ${config.maxResources} resources are allowed.`);
  }

  const seen = new Set<string>();
  let totalMaxPaymentAtomic = 0;
  for (const resource of request.resources) {
    if (seen.has(resource.id) || seen.has(resource.url)) {
      return reject('duplicate_resource', `Resource ${resource.id} appears more than once.`);
    }
    seen.add(resource.id);
    seen.add(resource.url);

    const definition = registry.get(resource.id);
    if (!definition) return reject('resource_not_allowed', `Resource ${resource.id} is not registered.`);

    let url: URL;
    try {
      url = new URL(resource.url);
    } catch {
      return reject('invalid_resource_url', `Resource ${resource.id} has an invalid URL.`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return reject('invalid_resource_url', 'Only HTTP and HTTPS resource URLs are allowed.');
    }
    if (!config.demoMode && isPrivateHostname(url.hostname) && !configuredHostIsPrivate) {
      return reject('resource_url_not_allowed', 'Private-network resource URLs are disabled.');
    }
    if (!matchesDefinition(url, definition, config)) {
      return reject('resource_url_not_allowed', `Resource ${resource.id} URL is not allowlisted.`);
    }
    if (!Number.isSafeInteger(resource.maxPayment) || resource.maxPayment < 0) {
      return reject('invalid_resource_payment', 'Resource payment limits must be non-negative integers.');
    }
    if (resource.maxPayment > config.maxResourcePaymentAtomic) {
      return reject('resource_over_budget', `Resource ${resource.id} exceeds the configured payment limit.`);
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
