import { Injectable } from '@nestjs/common';
import { MatchedQuestion } from '../types/matched-question';
import { PromptEnhancerRegistry } from './prompt-enhancer.registry';
import { PromptEnhancer } from './prompt-enhancer.types';

@Injectable()
export class PromptEnhancerComposer {
  constructor(private readonly registry: PromptEnhancerRegistry) {}

  composeEnrichSystemPrompt(
    basePrompt: string,
    enhancerIds?: readonly string[] | null,
  ): string {
    const enrichEnhancers = this.resolveEnrichEnhancers(enhancerIds);
    if (enrichEnhancers.length === 0) {
      return basePrompt;
    }

    const addons = enrichEnhancers
      .map(
        enhancer =>
          `---\nPrompt enhancer: ${enhancer.id}\n${enhancer.buildEnrichSystemAddon()}`,
      )
      .join('\n\n');

    return `${basePrompt}\n\n${addons}`;
  }

  composeEnrichUserPrompt(
    basePrompt: string,
    enhancerIds?: readonly string[] | null,
  ): string {
    const enrichEnhancers = this.resolveEnrichEnhancers(enhancerIds);
    if (enrichEnhancers.length === 0) {
      return basePrompt;
    }

    const addons: string[] = [];
    for (const enhancer of enrichEnhancers) {
      const addon = enhancer.buildEnrichUserAddon?.();
      if (addon?.trim()) {
        addons.push(`---\nPrompt enhancer: ${enhancer.id}\n${addon}`);
      }
    }

    if (addons.length === 0) {
      return basePrompt;
    }

    return `${basePrompt}\n\n${addons.join('\n\n')}`;
  }

  prepareMatchedQuestions(
    matchedQuestions: MatchedQuestion[],
    enhancerIds?: readonly string[] | null,
  ): MatchedQuestion[] {
    const enhancers = this.registry.resolve(enhancerIds);
    let current = matchedQuestions;

    for (const enhancer of enhancers) {
      if (enhancer.prepareMatchedQuestions) {
        current = enhancer.prepareMatchedQuestions(current);
      }
    }

    return current;
  }

  /**
   * Tightest maxQuestionsPerEnrichChunk among selected enrich enhancers.
   * Undefined when none of the selected enhancers set a cap.
   */
  resolveMaxQuestionsPerEnrichChunk(
    enhancerIds?: readonly string[] | null,
  ): number | undefined {
    const caps = this.resolveEnrichEnhancers(enhancerIds)
      .map(enhancer => enhancer.maxQuestionsPerEnrichChunk)
      .filter(
        (cap): cap is number =>
          typeof cap === 'number' && Number.isFinite(cap) && cap > 0,
      );

    if (caps.length === 0) {
      return undefined;
    }

    return Math.min(...caps);
  }

  private resolveEnrichEnhancers(
    enhancerIds?: readonly string[] | null,
  ): PromptEnhancer[] {
    return this.registry
      .resolve(enhancerIds)
      .filter(enhancer => enhancer.stages.includes('enrich'));
  }
}
