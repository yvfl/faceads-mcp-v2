import type { MetaClient } from '../meta-client.js';
import { getOperationStatus, inspectOperation } from './journal.js';

export async function handleGetOperationStatus(client: MetaClient, args: { request_id: string; inspect?: boolean }) {
  const result = args.inspect
    ? await inspectOperation(args.request_id, (endpoint, params) => client.get(endpoint, params))
    : await getOperationStatus(args.request_id);
  return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
}
