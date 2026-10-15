import { Types } from 'mongoose';
import {
  assignUpdatedBy,
  createdByFields,
  omitActorFields,
  toActorObjectId,
  updatedByFields,
} from './to-actor-object-id';

const ACTOR_ID = '507f1f77bcf86cd799439011';

describe('toActorObjectId', () => {
  it('returns undefined for a missing or invalid id', () => {
    expect(toActorObjectId()).toBeUndefined();
    expect(toActorObjectId('')).toBeUndefined();
    expect(toActorObjectId('not-an-id')).toBeUndefined();
  });

  it('returns an ObjectId for a valid id', () => {
    expect(toActorObjectId(ACTOR_ID)?.toString()).toBe(ACTOR_ID);
  });

  it('omits actor fields when the id is absent', () => {
    expect(createdByFields()).toEqual({});
    expect(updatedByFields(undefined)).toEqual({});
    const doc: { name: string; updatedBy?: Types.ObjectId } = {
      name: 'kept',
    };
    assignUpdatedBy(doc, 'bad-id');
    expect(doc).toEqual({ name: 'kept' });
  });

  it('sets only the requested actor field', () => {
    expect(createdByFields(ACTOR_ID)).toEqual({
      createdBy: new Types.ObjectId(ACTOR_ID),
    });
    expect(updatedByFields(ACTOR_ID)).toEqual({
      updatedBy: new Types.ObjectId(ACTOR_ID),
    });
    expect(updatedByFields(ACTOR_ID)).not.toHaveProperty('createdBy');
  });

  it('drops actor fields from response objects', () => {
    expect(
      omitActorFields({
        name: 'Exam',
        createdBy: ACTOR_ID,
        updatedBy: ACTOR_ID,
      }),
    ).toEqual({ name: 'Exam' });
  });
});
