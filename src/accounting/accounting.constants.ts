/** Snapshot is reused for an hour. The stored copy lives longer so a refresh can serve the previous result. */
export const ACCOUNTING_FRESH_MS = 60 * 60 * 1000;

export const ACCOUNTING_TTL_SEC = 2 * 60 * 60;

export const ACCOUNTING_LOCK_SEC = 60;

export const ACCOUNTING_POLL_MS = 200;

export const ACCOUNTING_POLL_ATTEMPTS = 75;
