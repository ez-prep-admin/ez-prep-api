import { UnauthorizedException } from '@nestjs/common';
import { GoogleIdTokenVerifier } from './google-id-token.verifier';

/**
 * These calls use the real Google library, not a mock.
 * A malformed or unsigned token must be rejected before we trust any claim in it.
 */
describe('GoogleIdTokenVerifier rejects untrusted tokens', () => {
  const verifier = new GoogleIdTokenVerifier();

  it('rejects a token that is not a JWT', async () => {
    await expect(
      verifier.verify('fake-token', ['web.apps.googleusercontent.com']),
    ).rejects.toThrow(UnauthorizedException);
  });
});
