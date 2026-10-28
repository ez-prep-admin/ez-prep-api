import {
  questionTagId,
  questionTagIds,
  questionTagNames,
} from './question-tag-names';

describe('question tag labels', () => {
  it('collects unique names from tags', () => {
    expect(
      questionTagNames({
        tags: [
          { name: 'Scales' },
          { name: '  ' },
          { name: 'Scales' },
          { name: 'Projection' },
        ],
      }),
    ).toEqual(['Scales', 'Projection']);
  });

  it('returns no names when only ids are present', () => {
    expect(questionTagNames({ tags: ['507f1f77bcf86cd799439011'] })).toEqual(
      [],
    );
  });

  it('collects unique ids from tags', () => {
    expect(
      questionTagIds({
        tags: [
          { _id: { toString: () => 'aaa' }, name: 'Scales' },
          { _id: 'aaa' },
          'bbb',
        ],
      }),
    ).toEqual(['aaa', 'bbb']);
  });

  it('reads a tag id from a populated document or a string', () => {
    expect(questionTagId('507f1f77bcf86cd799439011')).toBe(
      '507f1f77bcf86cd799439011',
    );
    expect(
      questionTagId({ name: 'Scales', _id: { toString: () => 'abc' } }),
    ).toBe('abc');
    expect(questionTagId({ toString: () => '507f1f77bcf86cd799439011' })).toBe(
      '507f1f77bcf86cd799439011',
    );
    expect(questionTagId(null)).toBeNull();
  });
});
