/** Absolute Redis session + refresh-cookie lifetime for browser logins (no sliding). */
export const WEB_SESSION_TTL_SEC = 7 * 24 * 60 * 60;

/** Short-lived web access JWT. Refresh via HttpOnly cookie. */
export const WEB_ACCESS_TTL_SEC = 15 * 60;

/**
 * Mobile idle window. Each successful refresh slides this forward from "now",
 * so an active app stays signed in indefinitely; 90 days unused → re-login.
 */
export const MOBILE_SESSION_TTL_SEC = 90 * 24 * 60 * 60;

/**
 * Mobile access JWT lifetime. Kept equal to the idle window so today's
 * mobile builds (access token only, no Phase 12 refresh yet) stay signed in
 * for up to 90 days. Phase 12 should shorten this (e.g. 1h) once refresh is wired.
 */
export const MOBILE_ACCESS_TTL_SEC = MOBILE_SESSION_TTL_SEC;

/**
 * Positive sid cache. Cache hit → zero Redis commands.
 * Revocation may lag up to this window on another instance.
 */
export const SESSION_SID_CACHE_TTL_MS = 90_000;

/**
 * How often we may write Redis lastSeenAt / Mongo lastActiveAt per sid/user.
 * Keeps Upstash under the free command budget.
 */
export const SESSION_ACTIVITY_TOUCH_MS = 12 * 60 * 1000;

export const AUTH_SESSION_STORE_ENV = 'AUTH_SESSION_STORE';
