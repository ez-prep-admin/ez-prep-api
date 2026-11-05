export type AuthClient = 'web' | 'mobile';

export interface StudentSessionRecord {
  userId: string;
  refreshTokenHash: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
  client: AuthClient;
  userAgent?: string;
  ip?: string;
}

export interface CreatedStudentSession {
  sid: string;
  refreshToken: string;
  expiresAt: Date;
  expiresInSec: number;
  client: AuthClient;
  /** False when Redis write failed and the caller should issue a legacy JWT. */
  persisted: boolean;
}

export interface ResolvedStudentSession {
  sid: string;
  userId: string;
  expiresAt: Date;
  client: AuthClient;
  /** True when Redis was skipped (cache hit, degraded, or forced). */
  fromCache: boolean;
}
