export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL_FAILURE' | 'FAILED';

export interface JsonSchemaProperty {
  type: 'string' | 'number' | 'boolean';
  maxLength?: number;
}

export interface JsonObjectSchema {
  type: 'object';
  required: string[];
  properties: Record<string, JsonSchemaProperty>;
  additionalProperties: false;
}

export interface RequestedResource {
  id: string;
  url: string;
  maxPayment: number;
  required?: boolean;
  expectedSchema: JsonObjectSchema;
}

export interface ExecuteShieldRequest {
  requestId: string;
  resources: RequestedResource[];
}

export interface ShieldConfig {
  maxJobSpendAtomic: number;
  maxResourcePaymentAtomic: number;
  maxResources: number;
  requestTimeoutMs: number;
  maxResponseBytes: number;
  quoteExpirySeconds: number;
  serviceFeeAtomic: number;
  demoMode: boolean;
  baseUrl: string;
}

export interface ResourceDefinition {
  id: string;
  method: 'GET' | 'POST';
  path: string;
  priceAtomic: number;
  schema: JsonObjectSchema;
}

export interface ResourceOutcome {
  id: string;
  paymentStatus: 'not_started' | 'settled' | 'failed';
  responseStatus?: number;
  validation: 'not_run' | 'passed' | 'rejected';
  txnId?: string;
  amountAtomic: number;
  durationMs: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface ReceiptPayments {
  upfront: string;
  downstream: string;
  serviceFee: string;
  remaining: string;
}

export interface ShieldReceipt {
  jobId: string;
  requestId: string;
  status: JobStatus;
  summary: { requested: number; completed: number; failed: number; rejections: number };
  payments: ReceiptPayments;
  resources: ResourceOutcome[];
  results: Record<string, unknown>;
  settlementTxnId: string;
  receiptPublicKey: string;
  signature: string;
  generatedAt: string;
}

export interface JobRecord {
  jobId: string;
  request: ExecuteShieldRequest;
  requestHash: string;
  quotedPriceAtomic: number;
  serviceFeeAtomic: number;
  expiresAt: number;
  binding: string;
  createdAt: number;
  status: JobStatus;
  paymentFingerprint?: string;
  settlementTxnId?: string;
  receipt?: ShieldReceipt;
}

export type NewJob = Omit<
  JobRecord,
  'status' | 'paymentFingerprint' | 'settlementTxnId' | 'receipt'
>;

export interface AuditEvent {
  jobId: string;
  requestId?: string;
  resourceId?: string;
  event: string;
  timestamp: number;
  paymentIntentId?: string;
  paymentStatus?: string;
  amountAtomic?: number;
  resourceUrl?: string;
  responseStatus?: number;
  validationResult?: string;
  durationMs?: number;
  errorCode?: string;
  details?: Record<string, unknown>;
}

