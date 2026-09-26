import { errorMessage, redactConnectionSecrets } from './redis-log';

describe('redis log redaction', () => {
  it('removes redis URLs from messages and errors', () => {
    const secret = 'rediss://default:super-secret@example.upstash.io:6379';
    expect(redactConnectionSecrets(`connect failed ${secret}`)).toBe(
      'connect failed redis://redacted',
    );
    expect(errorMessage(new Error(`dial ${secret} refused`))).toBe(
      'dial redis://redacted refused',
    );
    expect(errorMessage('plain failure')).toBe('plain failure');
  });
});
