/**
 * Markers that already selected the solutions section before LaTeX answer
 * headings were added. Order is the priority: the first one present wins,
 * even if a shorter heading appears earlier in the document.
 */
const LEGACY_SOLUTION_MARKERS = [
  '\\section*{ANSWERS AND SOLUTIONS}',
  '\\section*{Answers and Solutions}',
  '## ANSWERS AND SOLUTIONS',
  '## Answers and Solutions',
  '## SOLUTIONS',
  '## Solutions',
  '## ANSWERS',
  '## Answers',
  'Answer Key',
  'ANSWER KEY',
  'Answers:',
] as const;

/**
 * Headings used by Mathpix when a paper has no legacy marker above.
 * Arihant-style "\\section*{ANSWERS}" and "Hints and Explanations" live here.
 */
const EXTENDED_SOLUTION_MARKERS = [
  '\\section*{HINTS AND EXPLANATIONS}',
  '\\section*{Hints and Explanations}',
  '\\section*{Hints & Explanations}',
  '\\section*{HINTS AND SOLUTIONS}',
  '\\section*{Hints and Solutions}',
  '\\section*{SOLUTIONS}',
  '\\section*{Solutions}',
  '\\section*{ANSWERS}',
  '\\section*{Answers}',
  '## HINTS AND EXPLANATIONS',
  '## Hints and Explanations',
  '## HINTS AND SOLUTIONS',
  '## Hints and Solutions',
] as const;

export const KNOWN_SOLUTION_MARKERS = [
  ...LEGACY_SOLUTION_MARKERS,
  ...EXTENDED_SOLUTION_MARKERS,
] as const;

/**
 * Solution heading that should split questions from answers.
 * A legacy marker wins when one is present, so existing ## SOLUTIONS papers
 * keep that split. Extended headings apply only when none of those match,
 * and the earliest one in the document wins.
 */
export function findSolutionMarker(markdown: string): string | undefined {
  const legacy = LEGACY_SOLUTION_MARKERS.find(marker =>
    markdown.includes(marker),
  );
  if (legacy) {
    return legacy;
  }

  let best: { marker: string; index: number } | undefined;
  for (const marker of EXTENDED_SOLUTION_MARKERS) {
    const index = markdown.indexOf(marker);
    if (index === -1) {
      continue;
    }
    if (
      !best ||
      index < best.index ||
      (index === best.index && marker.length > best.marker.length)
    ) {
      best = { marker, index };
    }
  }

  return best?.marker;
}
