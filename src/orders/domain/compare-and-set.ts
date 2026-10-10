import type { Model } from 'mongoose';

export type TransitionResult<T> = {
  won: boolean;
  doc: T | null;
};

/**
 * One compare-and-set status write.
 * A same-status target is a loss: `to` is removed from `from` before the update.
 * A miss returns the current document with `won: false`.
 */
export async function compareAndSet<T>(
  model: Model<T>,
  id: unknown,
  from: readonly string[],
  to: string,
  set: Record<string, unknown> = {},
): Promise<TransitionResult<T>> {
  const sources = from.filter(status => status !== to);
  if (sources.length === 0) {
    const current = await model.findById(id).exec();
    return { won: false, doc: current };
  }

  const updated = await model
    .findOneAndUpdate(
      { _id: id, status: { $in: [...sources] } },
      { $set: { status: to, ...set } },
      { new: true },
    )
    .exec();
  if (updated) {
    return { won: true, doc: updated };
  }

  const current = await model.findById(id).exec();
  return { won: false, doc: current };
}
