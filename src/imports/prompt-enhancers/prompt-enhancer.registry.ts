import { BadRequestException, Injectable } from '@nestjs/common';
import { PROMPT_ENHANCER_IDS, PromptEnhancerId } from './prompt-enhancer.ids';
import {
  PromptEnhancer,
  PromptEnhancerCatalogItem,
} from './prompt-enhancer.types';
import { sharedPassageEnhancer } from './shared-passage.enhancer';

const REGISTERED_ENHANCERS: readonly PromptEnhancer[] = [
  sharedPassageEnhancer,
];

@Injectable()
export class PromptEnhancerRegistry {
  private readonly byId = new Map<PromptEnhancerId, PromptEnhancer>(
    REGISTERED_ENHANCERS.map(enhancer => [enhancer.id, enhancer]),
  );

  list(): PromptEnhancerCatalogItem[] {
    return REGISTERED_ENHANCERS.map(enhancer => ({
      id: enhancer.id,
      label: enhancer.label,
      description: enhancer.description,
    }));
  }

  /**
   * Resolves enhancer ids in request order. Empty/undefined → [].
   * Unknown ids throw BadRequestException.
   */
  resolve(ids?: readonly string[] | null): PromptEnhancer[] {
    if (!ids?.length) {
      return [];
    }

    const resolved: PromptEnhancer[] = [];
    const seen = new Set<string>();

    for (const rawId of ids) {
      const id = typeof rawId === 'string' ? rawId.trim() : '';
      if (!id || seen.has(id)) {
        continue;
      }
      seen.add(id);

      if (!this.isKnownId(id)) {
        throw new BadRequestException(
          `Unknown prompt enhancer "${id}". Allowed: ${PROMPT_ENHANCER_IDS.join(', ')}`,
        );
      }

      const enhancer = this.byId.get(id);
      if (!enhancer) {
        throw new BadRequestException(
          `Unknown prompt enhancer "${id}". Allowed: ${PROMPT_ENHANCER_IDS.join(', ')}`,
        );
      }
      resolved.push(enhancer);
    }

    return resolved;
  }

  private isKnownId(id: string): id is PromptEnhancerId {
    return (PROMPT_ENHANCER_IDS as readonly string[]).includes(id);
  }
}
