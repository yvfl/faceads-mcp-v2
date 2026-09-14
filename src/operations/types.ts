export type OperationStatus = 'pending' | 'succeeded' | 'failed' | 'unknown';

/** This record deliberately excludes tokens, raw request bodies and API error messages. */
export interface OperationRecord {
  key: string;
  ownerHash: string;
  requestId: string;
  ordinal: number;
  fingerprint: string;
  userId?: string;
  grantId?: string;
  tool: string;
  method: 'POST' | 'DELETE';
  endpoint: string;
  entityId?: string;
  changedFields: Record<string, string | number | boolean>;
  status: OperationStatus;
  createdAt: string;
  completedAt?: string;
  response?: Record<string, unknown>;
  error?: { type: string; code?: number };
}

export interface OperationStore {
  /** Atomically reserve a request key and reject an identical pending/unknown write. */
  reserve(record: OperationRecord): Promise<{ created: boolean; record: OperationRecord }>;
  finish(record: OperationRecord): Promise<void>;
  list(ownerHash: string, requestId: string): Promise<OperationRecord[]>;
}

export interface OperationReceipt {
  request_id: string;
  operation: number;
  tool: string;
  method: 'POST' | 'DELETE';
  endpoint: string;
  entity_id?: string;
  changed_fields: OperationRecord['changedFields'];
  status: OperationStatus;
  created_at: string;
  completed_at?: string;
  result?: Record<string, unknown>;
  error?: OperationRecord['error'];
  replayed?: boolean;
  next_step?: string;
}
