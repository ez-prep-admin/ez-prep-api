import { RedisKeyBuilder } from './redis-key.builder';
import { resolveRedisSettings } from './redis.settings';

describe('RedisKeyBuilder', () => {
  const keys = new RedisKeyBuilder(
    resolveRedisSettings({ INSTANCE_ID: 'examflex' }),
  );

  it('prefixes every key with the instance namespace', () => {
    expect(keys.key('session', 'abc')).toBe('examflex:session:abc');
    expect(keys.key('cache', 'questions', '42')).toBe(
      'examflex:cache:questions:42',
    );
    expect(keys.key('config', 'instance')).toBe('examflex:config:instance');
    expect(keys.key('ratelimit', 'login')).toBe('examflex:ratelimit:login');
  });

  it('rejects empty, wildcard, and cross-namespace segments', () => {
    expect(() => keys.key()).toThrow(/at least one segment/);
    expect(() => keys.key('session', 'a:b')).toThrow(/key segment/);
    expect(() => keys.key('*')).toThrow(/key segment/);
    expect(() => keys.key('  ')).toThrow(/key segment/);
  });

  it('accepts a normal prefix and rejects one that contains a colon', () => {
    expect(
      new RedisKeyBuilder(
        resolveRedisSettings({
          INSTANCE_ID: 'ezprep',
          REDIS_KEY_PREFIX: 'ok',
        }),
      ).key('session', '1'),
    ).toBe('ok:session:1');
    expect(() =>
      new RedisKeyBuilder({
        ...resolveRedisSettings({ INSTANCE_ID: 'ezprep' }),
        keyPrefix: 'bad:prefix',
      }).key('session', '1'),
    ).toThrow(/key prefix/);
  });
});
