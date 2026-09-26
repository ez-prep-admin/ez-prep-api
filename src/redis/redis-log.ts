const CONNECTION_URL = /rediss?:\/\/[^\s'"]+/gi;

/** Keeps connection credentials out of application logs. */
export function redactConnectionSecrets(message: string): string {
  return message.replace(CONNECTION_URL, 'redis://redacted');
}

export function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return redactConnectionSecrets(raw);
}
