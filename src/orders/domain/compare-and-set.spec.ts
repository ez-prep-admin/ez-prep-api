import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection, Model, Schema, Types } from 'mongoose';
import { compareAndSet } from './compare-and-set';

type Probe = { status: string; note?: string };

describe('compareAndSet', () => {
  let mongo: MongoMemoryServer;
  let connection: Connection;
  let model: Model<Probe>;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    connection = await mongoose
      .createConnection(mongo.getUri(), { autoIndex: false })
      .asPromise();
    model = connection.model<Probe>(
      'CompareAndSetProbe',
      new Schema({ status: String, note: String }),
    );
  });

  afterAll(async () => {
    await connection?.close();
    await mongo?.stop();
  });

  async function insert(status: string): Promise<Types.ObjectId> {
    const doc = await model.create({ status });
    return doc._id;
  }

  it('lets one caller win a status change', async () => {
    const id = await insert('PENDING');

    const result = await compareAndSet(model, id, ['PENDING'], 'PAID', {
      note: 'winner',
    });

    expect(result.won).toBe(true);
    expect(result.doc?.status).toBe('PAID');
    expect(result.doc?.note).toBe('winner');
  });

  it('returns the current document when a second caller loses', async () => {
    const id = await insert('PENDING');
    const [first, second] = await Promise.all([
      compareAndSet(model, id, ['PENDING'], 'PAID'),
      compareAndSet(model, id, ['PENDING'], 'PAID'),
    ]);

    const wins = [first, second].filter(result => result.won);
    expect(wins).toHaveLength(1);
    expect(second.doc?.status).toBe('PAID');
    expect(first.doc?.status).toBe('PAID');
  });

  it('does not write when the current status is not an allowed source', async () => {
    const id = await insert('CANCELLED');

    const result = await compareAndSet(model, id, ['PENDING'], 'PAID', {
      note: 'nope',
    });

    expect(result.won).toBe(false);
    expect(result.doc?.status).toBe('CANCELLED');
    expect(result.doc?.note).toBeUndefined();
  });

  it('treats a same-status target as a no-op', async () => {
    const id = await insert('PAID');

    const result = await compareAndSet(model, id, ['PAID'], 'PAID', {
      note: 'nope',
    });

    expect(result.won).toBe(false);
    expect(result.doc?.status).toBe('PAID');
    expect(result.doc?.note).toBeUndefined();
  });
});
