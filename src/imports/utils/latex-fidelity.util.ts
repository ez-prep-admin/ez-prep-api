/**
 * Safety net when the enrich LLM unwraps Mathpix math (\(...\) → plain text).
 * Default trust is always the AI; we only swap when source clearly has math
 * that the AI dropped on the *same* stem/option wording.
 */

const MATHPIX_SIGNAL = /\\\(|\\\[|\\%|\\frac\b/g;

export function countLatexFidelitySignals(text: string): number {
  return text ? (text.match(MATHPIX_SIGNAL)?.length ?? 0) : 0;
}

export function preferMathFaithfulText(
  aiText: string,
  sourceText: string,
): string {
  const ai = aiText?.trim() ?? '';
  const source = sourceText?.trim() ?? '';

  if (!ai) return source;
  if (!source) return ai;

  const sourceScore = countLatexFidelitySignals(source);
  const aiScore = countLatexFidelitySignals(ai);

  // AI kept as much (or more) math → trust AI structure/wording.
  if (sourceScore === 0 || aiScore >= sourceScore) {
    return ai;
  }

  // Only restore source math when AI looks like the same content, unwrapped.
  return isSamePlainContent(ai, source) ? source : ai;
}

/** Drop common exam attribution lines that ride along in Mathpix stems. */
export function stripQuestionStemMetadata(stem: string): string {
  return stem
    .split('\n')
    .filter(line => {
      const t = line.trim();
      if (!t) return true;
      if (/^(SSC|UPSC|IBPS|RRB|NEET|JEE|AIIMS|GATE)\b/i.test(t)) return false;
      if (/\bShift\s*\d+\b/i.test(t) && /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(t)) {
        return false;
      }
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function stripLatexToPlain(text: string): string {
  return text
    .replace(/\\[\[\]()]/g, '')
    .replace(/\\%/g, '%')
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{[^{}]*\})?/g, ' ')
    .replace(/[{}$]/g, '')
    .replace(/,/g, '')
    .replace(/₹\s*/g, '₹')
    .replace(/\s*%/g, '%')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isSamePlainContent(aiText: string, sourceText: string): boolean {
  const ai = stripLatexToPlain(aiText);
  const source = stripLatexToPlain(sourceText);
  if (!ai || !source) return false;
  if (ai === source) return true;

  const [shorter, longer] =
    ai.length <= source.length ? [ai, source] : [source, ai];
  return longer.includes(shorter) && shorter.length / longer.length >= 0.65;
}
