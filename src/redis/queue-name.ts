import { assertKeySegment } from './redis-key.builder';

/**
 * Instance-scoped BullMQ queue name. Queue names are never written inline
 * at call sites; they are logical names passed through this helper.
 *
 * BullMQ rejects ":" in the queue name, so the instance is joined with "-".
 * Redis keys stay isolated by the prefix `{instance}:bull`.
 */
export function queueName(namespace: string, logicalName: string): string {
  const scope = assertKeySegment(namespace, 'queue namespace');
  const name = assertKeySegment(logicalName, 'queue name');
  return `${scope}-${name}`;
}
