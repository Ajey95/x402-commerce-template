import type { JobRecord, NewJob, ShieldReceipt } from './types.js';

interface PaymentReservation {
  jobId: string;
  consumed: boolean;
}

export class InMemoryJobStore {
  private readonly jobs = new Map<string, JobRecord>();
  private readonly requestIds = new Map<string, string>();
  private readonly payments = new Map<string, PaymentReservation>();

  create(input: NewJob): JobRecord {
    const existingId = this.requestIds.get(input.request.requestId);
    if (existingId) {
      const existing = this.jobs.get(existingId)!;
      if (existing.requestHash !== input.requestHash) {
        throw new Error('requestId is already associated with different job input.');
      }
      return existing;
    }
    const job: JobRecord = { ...input, status: 'PENDING' };
    this.jobs.set(job.jobId, job);
    this.requestIds.set(job.request.requestId, job.jobId);
    return job;
  }

  get(jobId: string): JobRecord | undefined {
    return this.jobs.get(jobId);
  }

  getByRequestId(requestId: string): JobRecord | undefined {
    const jobId = this.requestIds.get(requestId);
    return jobId ? this.jobs.get(jobId) : undefined;
  }

  list(limit = 50): JobRecord[] {
    return [...this.jobs.values()].slice(-limit).reverse();
  }

  claim(jobId: string):
    | { acquired: true; job: JobRecord }
    | { acquired: false; reason: 'missing' | 'processing' | 'terminal'; job?: JobRecord } {
    const job = this.jobs.get(jobId);
    if (!job) return { acquired: false, reason: 'missing' };
    if (job.status === 'PROCESSING') return { acquired: false, reason: 'processing', job };
    if (job.status === 'COMPLETED' || job.status === 'PARTIAL_FAILURE' || job.status === 'FAILED') {
      return { acquired: false, reason: 'terminal', job };
    }
    job.status = 'PROCESSING';
    return { acquired: true, job };
  }

  setSettlement(jobId: string, paymentFingerprint: string, settlementTxnId: string): void {
    const job = this.requireJob(jobId);
    job.paymentFingerprint = paymentFingerprint;
    job.settlementTxnId = settlementTxnId;
  }

  complete(jobId: string, receipt: ShieldReceipt): JobRecord {
    const job = this.requireJob(jobId);
    job.status = receipt.status;
    job.receipt = receipt;
    return job;
  }

  fail(jobId: string): void {
    this.requireJob(jobId).status = 'FAILED';
  }

  reservePayment(fingerprint: string, jobId: string):
    | { reserved: true }
    | { reserved: false; existingJobId: string } {
    const existing = this.payments.get(fingerprint);
    if (existing) return { reserved: false, existingJobId: existing.jobId };
    this.payments.set(fingerprint, { jobId, consumed: false });
    return { reserved: true };
  }

  consumePayment(fingerprint: string, jobId: string): void {
    const reservation = this.payments.get(fingerprint);
    if (!reservation || reservation.jobId !== jobId) throw new Error('Payment proof is not reserved for this job.');
    reservation.consumed = true;
  }

  releasePayment(fingerprint: string, jobId: string): void {
    const reservation = this.payments.get(fingerprint);
    if (reservation?.jobId === jobId && !reservation.consumed) this.payments.delete(fingerprint);
  }

  private requireJob(jobId: string): JobRecord {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Unknown job ${jobId}.`);
    return job;
  }
}

