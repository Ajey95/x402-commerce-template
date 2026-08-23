import type { RequestedResource, ResourceDefinition } from './types.js';

export interface BuiltProviderRequest {
  url: string;
  init: RequestInit;
}

export function buildProviderRequest(
  request: RequestedResource,
  definition: ResourceDefinition,
  timeoutMs: number,
): BuiltProviderRequest {
  const url = new URL(definition.path, definition.origin);
  const base: RequestInit = {
    method: definition.method,
    redirect: 'manual',
    signal: AbortSignal.timeout(definition.timeoutMs ?? timeoutMs),
    headers: { accept: 'application/json' },
  };

  if (definition.method === 'GET') {
    for (const [key, value] of Object.entries(request.input)) {
      url.searchParams.set(key, String(value));
    }
    return { url: url.toString(), init: base };
  }

  return {
    url: url.toString(),
    init: {
      ...base,
      headers: { ...base.headers, 'content-type': 'application/json' },
      body: JSON.stringify(request.input),
    },
  };
}
