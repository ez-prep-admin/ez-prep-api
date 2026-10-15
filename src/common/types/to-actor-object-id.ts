import { Types } from 'mongoose';

/**
 * Converts an admin user id into an ObjectId for createdBy / updatedBy.
 * Missing or invalid ids are omitted so writes still succeed.
 */
export function toActorObjectId(
  actorUserId?: string,
): Types.ObjectId | undefined {
  if (!actorUserId || !Types.ObjectId.isValid(actorUserId)) {
    return undefined;
  }

  return new Types.ObjectId(actorUserId);
}

/** Spread onto a create payload. Omitted when the actor id is missing. */
export function createdByFields(
  actorUserId?: string,
): { createdBy: Types.ObjectId } | Record<string, never> {
  const createdBy = toActorObjectId(actorUserId);
  return createdBy ? { createdBy } : {};
}

/** Spread onto an update or soft-delete payload. Never includes createdBy. */
export function updatedByFields(
  actorUserId?: string,
): { updatedBy: Types.ObjectId } | Record<string, never> {
  const updatedBy = toActorObjectId(actorUserId);
  return updatedBy ? { updatedBy } : {};
}

/** Sets updatedBy on a loaded document when the actor id is valid. */
export function assignUpdatedBy<T extends { updatedBy?: Types.ObjectId }>(
  doc: T,
  actorUserId?: string,
): T {
  const updatedBy = toActorObjectId(actorUserId);
  if (updatedBy) {
    doc.updatedBy = updatedBy;
  }
  return doc;
}

/** Drops actor fields so existing API payloads stay unchanged. */
export function omitActorFields<T extends object>(obj: T): T {
  const copy = { ...obj } as T & {
    createdBy?: unknown;
    updatedBy?: unknown;
  };
  delete copy.createdBy;
  delete copy.updatedBy;
  return copy;
}
