import type { AuditEvent } from './types.js';

const SECRET_PATTERN = /(mnemonic|private.?key|secret|credential|authorization|payment.?signature)/i;

function redact(value: unknown, key = ''): unknown {
  if (SECRET_PATTERN.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map(item => redact(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entry]) => [entryKey, redact(entry, entryKey)]));
  }
  return value;
}

export class AuditLog {
  private readonly events: AuditEvent[] = [];

  constructor(private readonly capacity = 500) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new Error('Audit capacity must be positive.');
  }

  record(event: AuditEvent): AuditEvent {
    const safe = redact(event) as AuditEvent;
    this.events.push(safe);
    while (this.events.length > this.capacity) this.events.shift();
    return safe;
  }

  list(jobId?: string): AuditEvent[] {
    const source = jobId ? this.events.filter(event => event.jobId === jobId) : this.events;
    return source.map(event => structuredClone(event));
  }
}

