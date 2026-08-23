export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL_FAILURE' | 'FAILED';

export interface JsonPrimitiveSchemaProperty {
  type: 'string' | 'number' | 'boolean';
  maxLength?: number;
  enum?: string[];
  const?: string | number | boolean;
}

export interface JsonObjectSchema {
  type: 'object';
  required: string[];
  properties: Record<string, JsonSchemaProperty>;
  additionalProperties: false;
}

export type JsonSchemaProperty = JsonPrimitiveSchemaProperty | JsonObjectSchema;

export type JsonObject = Record<string, unknown>;

export interface RequestedResource {
  id: string;
  input: JsonObject;
  maxPayment: number;
  required: boolean;
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
  name: string;
  origin: string;
  method: 'GET' | 'POST';
  path: string;
  priceAtomic: number;
  maxPriceAtomic?: number;
  /** Optional expected provider recipient. Owned demo providers use the shield PAY_TO_ADDRESS. */
  payTo?: string;
  inputSchema: JsonObjectSchema;
  responseSchema: JsonObjectSchema;
  trust: 'owned-demo' | 'external-curated';
  description: string;
  tags: string[];
  timeoutMs?: number;
  maxResponseBytes?: number;
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
