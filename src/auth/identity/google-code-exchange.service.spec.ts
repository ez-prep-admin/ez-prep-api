import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleCodeExchangeService,
  readGoogleRedirectUris,
  webClientId,
} from './google-code-exchange.service';

describe('GoogleCodeExchangeService', () => {
  const configValues: Record<string, string> = {
    GOOGLE_CLIENT_ID: 'web.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'secret-value',
    GOOGLE_REDIRECT_URIS: 'https://www.ezprep.in/,http://localhost:3001',
  };
  const config = {
    get: (key: string) => configValues[key],
  } as unknown as ConfigService;

  const service = new GoogleCodeExchangeService(config);
  const input = {
    code: 'auth-code',
    redirectUri: 'http://localhost:3001',
    codeVerifier: 'a'.repeat(43),
  };

  const originalFetch = global.fetch;

  beforeEach(() => {
    configValues.GOOGLE_CLIENT_ID = 'web.apps.googleusercontent.com';
    configValues.GOOGLE_CLIENT_SECRET = 'secret-value';
    configValues.GOOGLE_REDIRECT_URIS =
      'https://www.ezprep.in/,http://localhost:3001';
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('parses the client id and the registered redirect allowlist', () => {
    expect(webClientId(config)).toBe('web.apps.googleusercontent.com');
    expect(readGoogleRedirectUris(config)).toEqual([
      'https://www.ezprep.in/',
      'http://localhost:3001',
    ]);
    expect(
      webClientId({
        get: (key: string) =>
          key === 'GOOGLE_CLIENT_IDS'
            ? ' first.apps.googleusercontent.com , second.apps.googleusercontent.com '
            : undefined,
      } as unknown as ConfigService),
    ).toBe('first.apps.googleusercontent.com');
    expect(
      readGoogleRedirectUris({
        get: () => undefined,
      } as unknown as ConfigService),
    ).toEqual([]);
  });

  it('exchanges the code and returns only a three-part ID token', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        id_token: 'header.payload.signature',
        access_token: 'should-not-leave-the-server',
      }),
    });

    await expect(service.exchange(input)).resolves.toBe(
      'header.payload.signature',
    );

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://oauth2.googleapis.com/token');
    const [, request] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      { body: { toString(): string } },
    ];
    const body = request.body.toString();
    expect(body).toContain('client_secret=secret-value');
    expect(body).toContain('code=auth-code');
    expect(body).toContain(
      `redirect_uri=${encodeURIComponent('http://localhost:3001')}`,
    );
    expect(body).toContain(`code_verifier=${'a'.repeat(43)}`);
  });

  it('refuses a redirect URI that was not registered', async () => {
    await expect(
      service.exchange({
        ...input,
        redirectUri: 'https://evil.example/callback',
      }),
    ).rejects.toThrow(/redirect/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fails closed when the client secret or allowlist is missing', async () => {
    configValues.GOOGLE_CLIENT_SECRET = '';
    await expect(service.exchange(input)).rejects.toThrow(/not configured/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a Google response that is not a JWT', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id_token: 'not-a-jwt' }),
    });

    await expect(service.exchange(input)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an error response, a network failure, and a body that is not JSON', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'invalid_grant' }),
    });
    await expect(service.exchange(input)).rejects.toThrow(
      UnauthorizedException,
    );

    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));
    await expect(service.exchange(input)).rejects.toThrow(
      UnauthorizedException,
    );

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('bad json');
      },
    });
    await expect(service.exchange(input)).rejects.toThrow(
      UnauthorizedException,
    );

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'only-access' }),
    });
    await expect(service.exchange(input)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
