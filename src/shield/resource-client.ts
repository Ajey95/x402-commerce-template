import type { ResourceDefinition, RequestedResource } from './types.js';

export interface ResourceCallResult {
  status: number;
  transaction: string;
  amountAtomic: number;
  durationMs: number;
  data: unknown;
}

export interface ResourceClient {
  execute(request: RequestedResource, definition: ResourceDefinition, jobId?: string): Promise<ResourceCallResult>;
}

export interface ResourceCallErrorDetails {
  paymentStatus: 'not_started' | 'settled' | 'failed';
  durationMs: number;
  status?: number;
  transaction?: string;
  amountAtomic?: number;
}

export class ResourceCallError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: ResourceCallErrorDetails,
  ) {
    super(message);
    this.name = 'ResourceCallError';
  }
}

