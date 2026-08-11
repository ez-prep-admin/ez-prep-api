/**
 * Detect DeepSeek failures caused by thinking+content sharing max_tokens.
 * Empty content and finish_reason=length both surface as these messages.
 */
export function isOutputBudgetExhaustionError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('truncated before valid json') ||
    normalized.includes('empty batch response') ||
    normalized.includes('empty response for question')
  );
}
