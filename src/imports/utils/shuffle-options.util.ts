import { ImportQuestionOption } from '../types/import-question';

/**
 * Fisher–Yates shuffle of saved options.
 *
 * The enrich model often places the factually correct choice first and labels
 * it "a". Admin and student UIs render options in array order (index 0 is A).
 * Shuffling the option objects keeps each option's text, image, and id
 * together, so `correctAnswer` still points at the same fact while its
 * displayed letter is random.
 */
export function shuffleImportOptions(
  options: ImportQuestionOption[],
  random: () => number = Math.random,
): ImportQuestionOption[] {
  const next = [...options];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = next[index];
    next[index] = next[swapIndex];
    next[swapIndex] = current;
  }

  return next;
}
