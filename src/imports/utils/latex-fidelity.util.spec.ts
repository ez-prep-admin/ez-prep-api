import {
  countLatexFidelitySignals,
  preferMathFaithfulText,
  stripLatexToPlain,
  stripQuestionStemMetadata,
} from './latex-fidelity.util';

describe('latex-fidelity.util', () => {
  it('scores Mathpix delimiters and ignores plain unicode', () => {
    expect(
      countLatexFidelitySignals('Ramesh has \\(₹ 15,000\\) at \\(10 \\%\\).'),
    ).toBeGreaterThan(countLatexFidelitySignals('Ramesh has ₹15,000 at 10%.'));
  });

  it('restores source when AI unwraps the same stem', () => {
    const source = 'Ramesh has \\(₹ 15,000\\) at \\(10 \\%\\) simple interest.';
    const ai = 'Ramesh has ₹15,000 at 10% simple interest.';
    expect(preferMathFaithfulText(ai, source)).toBe(source);
  });

  it('keeps AI when it preserved math', () => {
    const source = 'Value is \\(10 \\%\\).';
    const ai = 'The value is \\(10 \\%\\) per annum.';
    expect(preferMathFaithfulText(ai, source)).toBe(ai);
  });

  it('keeps AI when wording diverges even if source has more math', () => {
    const source = 'OCR junk with \\(\\mu\\) and \\(\\frac{1}{f}\\).';
    const ai = 'Which of the following is correct for a convex lens?';
    expect(preferMathFaithfulText(ai, source)).toBe(ai);
  });

  it('strips SSC attribution from stems', () => {
    expect(
      stripQuestionStemMetadata(
        'Ramesh has \\(₹ 15,000\\).\nSSC CGL 17/09/2025 (Shift 3)\nFind the amount.',
      ),
    ).toBe('Ramesh has \\(₹ 15,000\\).\nFind the amount.');
  });

  it('normalizes for plain comparison', () => {
    expect(stripLatexToPlain('Rate \\(10 \\%\\)')).toBe('rate 10%');
  });
});
