import { CurrentAffairSchema } from './current-affair.schema';

describe('CurrentAffairSchema', () => {
  it('uses the currentaffairs collection', () => {
    expect(CurrentAffairSchema.get('collection')).toBe('currentaffairs');
  });

  it('exposes an id virtual from _id', () => {
    const virtuals = CurrentAffairSchema.virtuals as Record<
      string,
      { getters: Array<(this: { _id: { toHexString: () => string } }) => string> }
    >;
    const getter = virtuals.id.getters[0];
    expect(
      getter.call({ _id: { toHexString: () => '64f123456789abcdef123456' } }),
    ).toBe('64f123456789abcdef123456');
  });

  it('strips mongoose internals in toJSON', () => {
    const { transform } = CurrentAffairSchema.get('toJSON') as {
      transform: (
        doc: unknown,
        ret: Record<string, unknown>,
      ) => Record<string, unknown>;
    };
    expect(
      transform({}, { _id: 'x', __v: 0, title: 'Satellite launch' }),
    ).toEqual({ title: 'Satellite launch' });
  });

  it('strips mongoose internals in toObject', () => {
    const { transform } = CurrentAffairSchema.get('toObject') as {
      transform: (
        doc: unknown,
        ret: Record<string, unknown>,
      ) => Record<string, unknown>;
    };
    expect(
      transform({}, { _id: 'x', __v: 0, title: 'Satellite launch' }),
    ).toEqual({ title: 'Satellite launch' });
  });

  it('soft-delete pre-find middleware filters deleted documents', () => {
    const query = { where: jest.fn() };
    const hookStore = (
      CurrentAffairSchema as unknown as {
        s: {
          hooks: {
            _pres: Map<string, Array<{ fn?: (this: typeof query) => void }>>;
          };
        };
      }
    ).s.hooks._pres;

    const findHooks = hookStore.get('find') ?? [];
    const fn = findHooks.find(hook => typeof hook.fn === 'function')?.fn;
    expect(fn).toEqual(expect.any(Function));
    fn!.call(query);
    expect(query.where).toHaveBeenCalledWith({ isDeleted: { $ne: true } });
  });
});
