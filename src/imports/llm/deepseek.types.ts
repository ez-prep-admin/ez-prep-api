export interface DeepseekLlmResult {
  content: string;
  finishReason: string | null;
  completionTokens: number | null;
  promptTokens: number | null;
  totalTokens: number | null;
}

export interface DeepseekThinkingOptions {
  enabled: boolean;
  reasoningEffort?: 'low' | 'medium' | 'high';
}
