import {
  extractCorrectAnswerLabel,
  resolveCorrectAnswerLabel,
} from './extract-correct-answer-label.util';

describe('extractCorrectAnswerLabel', () => {
  it('reads Sol.N.(letter) keys', () => {
    expect(extractCorrectAnswerLabel('Sol.48.(d) because of allotment')).toBe(
      'd',
    );
    expect(extractCorrectAnswerLabel('Sol.1.(c)\nLong explanation')).toBe('c');
  });

  it('reads Answer / Ans / correct option phrasing', () => {
    expect(extractCorrectAnswerLabel('Answer: (b)')).toBe('b');
    expect(extractCorrectAnswerLabel('Ans. c')).toBe('c');
    expect(extractCorrectAnswerLabel('Correct answer: a')).toBe('a');
    expect(extractCorrectAnswerLabel('Correct option is (d)')).toBe('d');
    expect(extractCorrectAnswerLabel('Option (b) is correct.')).toBe('b');
  });

  it('reads a short leading key line', () => {
    expect(extractCorrectAnswerLabel('(c)\nWork shown below')).toBe('c');
    expect(extractCorrectAnswerLabel('1. (b)\nReasoning')).toBe('b');
  });

  it('returns null when no explicit letter is present', () => {
    expect(
      extractCorrectAnswerLabel('Derive from first principles.'),
    ).toBeNull();
    expect(extractCorrectAnswerLabel(undefined)).toBeNull();
  });
});

describe('resolveCorrectAnswerLabel', () => {
  it('overrides a biased model label with the solution letter', () => {
    expect(resolveCorrectAnswerLabel('a', 'Sol.2.(c) explanation')).toEqual({
      label: 'c',
      overridden: true,
      sourceLabel: 'c',
    });
  });

  it('keeps the model label when no solution letter is found', () => {
    expect(resolveCorrectAnswerLabel('b', 'No explicit key')).toEqual({
      label: 'b',
      overridden: false,
      sourceLabel: null,
    });
  });
});
