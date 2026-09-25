import { UnauthorizedException } from '@nestjs/common';

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

import { OAuth2Client } from 'google-auth-library';
import { GoogleIdTokenVerifier } from './google-id-token.verifier';

describe('GoogleIdTokenVerifier', () => {
  function verifierAndMock() {
    const verifier = new GoogleIdTokenVerifier();
    const results = (OAuth2Client as unknown as jest.Mock).mock.results;
    const client = results[results.length - 1]?.value as {
      verifyIdToken: jest.Mock;
    };
    return { verifier, verifyIdToken: client.verifyIdToken };
  }

  it('returns the payload from a verified Google ID token', async () => {
    const { verifier, verifyIdToken } = verifierAndMock();
    const payload = { sub: 'sub', aud: 'web', iss: 'https://accounts.google.com' };
    verifyIdToken.mockResolvedValue({ getPayload: () => payload });

    await expect(
      verifier.verify('token', ['web.apps.googleusercontent.com']),
    ).resolves.toBe(payload);
    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'token',
      audience: ['web.apps.googleusercontent.com'],
    });
  });

  it('rejects a token Google cannot verify', async () => {
    const { verifier, verifyIdToken } = verifierAndMock();
    verifyIdToken.mockRejectedValue(new Error('Token used too late'));

    await expect(verifier.verify('bad', ['web'])).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a ticket with no payload', async () => {
    const { verifier, verifyIdToken } = verifierAndMock();
    verifyIdToken.mockResolvedValue({ getPayload: () => undefined });

    await expect(verifier.verify('empty', ['web'])).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
