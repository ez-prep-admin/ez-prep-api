import { SHARED_PASSAGE_ENHANCER_ID } from './prompt-enhancer.ids';
import { PromptEnhancer } from './prompt-enhancer.types';

export const SHARED_PASSAGE_ENRICH_SYSTEM_ADDON = `PROMPT ENHANCER — shared passage (multiple questions):
This PDF may contain a shared reading comprehension (or similar) passage followed by several questions that all depend on that same passage.

When you detect that pattern:
1. Identify the FULL shared passage text that applies to the group of questions (do not invent or summarize it).
2. For EVERY question in that group, set questionText to: the complete shared passage, then a blank line, then that question's specific stem/prompt only.
3. Each question must still be independently answerable from its own questionText alone (passage + specific stem).
4. Options, correctAnswer, explanation, and difficultyLevel remain specific to each individual question.
5. Preserve the passage and stems verbatim (including LaTeX/math delimiters) — do not shorten the passage on later questions.
6. If a matched QUESTION BLOCK already includes the shared passage, keep it once at the start of questionText (do not duplicate).
7. If no shared-passage pattern is present in the input, extract questions normally with no special passage handling.

EXAMPLE (reading comprehension — one passage, five questions):

Source layout (passage appears once, then Q1…Q5):
---
Read the passage carefully and answer the questions that follow.
The Indian Railways, one of the largest rail networks in the world, has often been described as the lifeline of the nation. It began in 1853 with a short stretch of 34 km between Bombay and Thane, and has since grown into a vast system that carries millions of passengers and huge volumes of freight every day. Beyond transport, the railways have played a significant role in uniting the country, enabling people from distant regions to travel, trade and share cultures. However, the system faces challenges such as overcrowding, ageing infrastructure and safety concerns. In recent years, the government has focused on electrification, modernisation of stations and the introduction of faster trains to improve efficiency and reduce pollution. Because electric traction is cheaper and cleaner than diesel, the push for electrification is expected to lower both operating costs and carbon emissions over the long term. Experts believe that sustained investment in safety technology and track renewal is essential if the railways are to meet the growing demands of a young and aspirational population.

Q1. In which year did the Indian Railways begin its journey, according to the passage?
(A) 1835
(B) 1853
(C) 1857
(D) 1883
Ans: (B) 1853
---

WRONG questionText for Q1 (stem only — missing the shared passage):
"In which year did the Indian Railways begin its journey, according to the passage?"

CORRECT questionText for Q1 (full passage + blank line + specific stem). Q2–Q5 must use this SAME full passage at the start, each with its own stem:
"The Indian Railways, one of the largest rail networks in the world, has often been described as the lifeline of the nation. It began in 1853 with a short stretch of 34 km between Bombay and Thane, and has since grown into a vast system that carries millions of passengers and huge volumes of freight every day. Beyond transport, the railways have played a significant role in uniting the country, enabling people from distant regions to travel, trade and share cultures. However, the system faces challenges such as overcrowding, ageing infrastructure and safety concerns. In recent years, the government has focused on electrification, modernisation of stations and the introduction of faster trains to improve efficiency and reduce pollution. Because electric traction is cheaper and cleaner than diesel, the push for electrification is expected to lower both operating costs and carbon emissions over the long term. Experts believe that sustained investment in safety technology and track renewal is essential if the railways are to meet the growing demands of a young and aspirational population.

In which year did the Indian Railways begin its journey, according to the passage?"

For that Q1: correctAnswer "b", options a–d as in the source, explanation from the solution. Repeat the same passage prefix for Q2 (34 km), Q3 (NOT mentioned), Q4 (electrification), Q5 (inference) — only the stem after the blank line changes.`;

/**
 * Shared-passage enrich repeats the full passage in every questionText, so a
 * default 20-question non-STEM chunk can exhaust the output token budget.
 * Cap at 5 (same scale as STEM thinking chunks) when this enhancer is on.
 */
export const SHARED_PASSAGE_MAX_QUESTIONS_PER_CHUNK = 5;

export const sharedPassageEnhancer: PromptEnhancer = {
  id: SHARED_PASSAGE_ENHANCER_ID,
  label: 'Shared passage (multiple questions)',
  description:
    'Use when one reading passage (or similar stem) is followed by several questions that all depend on it. Each saved question gets the full passage prepended to its specific stem.',
  stages: ['enrich'],
  maxQuestionsPerEnrichChunk: SHARED_PASSAGE_MAX_QUESTIONS_PER_CHUNK,
  buildEnrichSystemAddon: () => SHARED_PASSAGE_ENRICH_SYSTEM_ADDON,
};
