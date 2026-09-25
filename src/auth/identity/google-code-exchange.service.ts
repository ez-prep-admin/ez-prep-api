import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readGoogleClientIds } from './google-identity.strategy';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export interface GoogleAuthorizationCode {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}

/**
 * Exchanges a one-time Google authorization code for an ID token.
 * The client secret stays on the server. The ID token is not trusted until
 * GoogleIdTokenVerifier checks its signature and claims.
 */
@Injectable()
export class GoogleCodeExchangeService {
  constructor(private readonly configService: ConfigService) {}

  async exchange(input: GoogleAuthorizationCode): Promise<string> {
    const clientId = webClientId(this.configService);
    const clientSecret = this.configService
      .get<string>('GOOGLE_CLIENT_SECRET')
      ?.trim();
    const allowedRedirects = readGoogleRedirectUris(this.configService);

    if (!clientId || !clientSecret || allowedRedirects.length === 0) {
      throw new ServiceUnavailableException('Google sign-in is not configured');
    }

    if (!allowedRedirects.includes(input.redirectUri)) {
      throw new UnauthorizedException('Unrecognized Google redirect');
    }

    const body = new URLSearchParams({
      code: input.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: input.codeVerifier,
    });

    let response: Response;
    try {
      response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch {
      throw new UnauthorizedException('Invalid Google sign-in');
    }

    if (!response.ok) {
      throw new UnauthorizedException('Invalid Google sign-in');
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new UnauthorizedException('Invalid Google sign-in');
    }

    const idToken =
      payload &&
      typeof payload === 'object' &&
      'id_token' in payload &&
      typeof (payload as { id_token?: unknown }).id_token === 'string'
        ? (payload as { id_token: string }).id_token.trim()
        : '';

    if (!idToken || idToken.split('.').length !== 3) {
      throw new UnauthorizedException('Invalid Google sign-in');
    }

    return idToken;
  }
}

export function readGoogleRedirectUris(configService: ConfigService): string[] {
  const raw = configService.get<string>('GOOGLE_REDIRECT_URIS') ?? '';
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const uri = part.trim();
    if (uri) {
      seen.add(uri);
    }
  }
  return [...seen];
}

export function webClientId(configService: ConfigService): string {
  const single = configService.get<string>('GOOGLE_CLIENT_ID')?.trim();
  if (single) {
    return single;
  }
  return readGoogleClientIds(configService)[0] ?? '';
}
