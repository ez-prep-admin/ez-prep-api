import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client, TokenPayload } from 'google-auth-library';

/**
 * Verifies a Google ID token with Google's public certificates.
 * Certificate caching stays in-process. No shared session or droplet-local state.
 */
@Injectable()
export class GoogleIdTokenVerifier {
  private readonly client = new OAuth2Client();

  async verify(idToken: string, audiences: string[]): Promise<TokenPayload> {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: audiences,
      });
      const payload = ticket.getPayload();
      if (!payload) {
        throw new UnauthorizedException('Invalid Google sign-in');
      }
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid Google sign-in');
    }
  }
}
