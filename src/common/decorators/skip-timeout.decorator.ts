import { SetMetadata } from '@nestjs/common';

export const SKIP_TIMEOUT_KEY = 'skipTimeout';

/**
 * Disables the global request timeout for long-running handlers
 * (e.g. LLM enrichment pipelines).
 */
export const SkipTimeout = () => SetMetadata(SKIP_TIMEOUT_KEY, true);
