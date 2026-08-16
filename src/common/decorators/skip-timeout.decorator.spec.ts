import { SetMetadata } from '@nestjs/common';
import { SKIP_TIMEOUT_KEY, SkipTimeout } from './skip-timeout.decorator';

jest.mock('@nestjs/common', () => {
  const actual = jest.requireActual('@nestjs/common');
  return {
    ...actual,
    SetMetadata: jest.fn((...args: unknown[]) => actual.SetMetadata(...args)),
  };
});

describe('SkipTimeout', () => {
  it('should expose the metadata key', () => {
    expect(SKIP_TIMEOUT_KEY).toBe('skipTimeout');
  });

  it('should set skipTimeout metadata to true', () => {
    SkipTimeout();
    expect(SetMetadata).toHaveBeenCalledWith(SKIP_TIMEOUT_KEY, true);
  });
});
