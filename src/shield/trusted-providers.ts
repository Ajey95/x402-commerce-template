import type { ResourceDefinition } from './types.js';

/**
 * Explicitly curated external x402 providers.
 *
 * Keep this list empty until a provider has been independently reviewed for:
 * - HTTPS origin/path/method
 * - Algorand/x402 compatibility and expected price
 * - exact request and response schemas
 * - trustworthy use case and operational ownership
 *
 * Bazaar discovery is not authorization. Never populate this list automatically from discovery output.
 */
export const TRUSTED_EXTERNAL_PROVIDERS: ResourceDefinition[] = [];
