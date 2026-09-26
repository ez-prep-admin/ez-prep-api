import { queueName } from './queue-name';

describe('queueName', () => {
  it('scopes a logical queue to the instance namespace', () => {
    expect(queueName('ezprep', 'import-parse')).toBe('ezprep-import-parse');
    expect(queueName(' examflex ', 'import-enrich')).toBe(
      'examflex-import-enrich',
    );
  });

  it('refuses names that would leave the namespace', () => {
    expect(() => queueName('ezprep', 'import:enrich')).toThrow(/queue name/);
    expect(() => queueName('ez prep', 'import-enrich')).toThrow(
      /queue namespace/,
    );
  });
});
