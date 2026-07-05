export interface DeepseekLlmResult {
  content: string;
  finishReason: string | null;
  completionTokens: number | null;
  promptTokens: number | null;
  totalTokens: number | null;
}
