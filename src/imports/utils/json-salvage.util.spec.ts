import {
  fixInvalidJsonStringEscapes,
  jsonPreview,
  salvageJson,
} from './json-salvage.util';

describe('json-salvage.util', () => {
  it('parses valid JSON directly', () => {
    const result = salvageJson('{"questions":[]}');

    expect(result.strategy).toBe('direct');
    expect(result.parsed).toEqual({ questions: [] });
  });

  it('strips markdown fences before parsing', () => {
    const result = salvageJson('```json\n{"questions":[]}\n```');

    expect(result.strategy).toBe('fences-stripped');
    expect(result.parsed).toEqual({ questions: [] });
  });

  it('extracts a JSON object from surrounding text', () => {
    const result = salvageJson(
      'Here is the output:\n{"questions":[]}\nThanks.',
    );

    expect(result.strategy).toBe('object-extracted');
    expect(result.parsed).toEqual({ questions: [] });
  });

  it('removes trailing commas before closing braces', () => {
    const result = salvageJson('{"questions":[{"number":1},]}');

    expect(result.parsed).toEqual({ questions: [{ number: 1 }] });
  });

  it('fixes invalid LaTeX backslash escapes inside JSON strings', () => {
    // Model often emits raw \( / \pi inside JSON strings (invalid JSON).
    const broken =
      '{ "questions": [ { "number": 65, "options": [ { "label": "a", "text": "\\(36+12 \\pi \\mathrm{~cm}\\)" } ] } ] }';

    const result = salvageJson(broken);
    expect(result.strategy).toBe('invalid-escapes-fixed');

    const parsed = result.parsed as {
      questions: Array<{ options: Array<{ text: string }> }>;
    };
    expect(parsed.questions[0].options[0].text).toContain('\\(');
    expect(parsed.questions[0].options[0].text).toContain('\\pi');
    expect(parsed.questions[0].options[0].text).toContain('\\mathrm');
  });

  it('fixInvalidJsonStringEscapes doubles only illegal escapes', () => {
    expect(fixInvalidJsonStringEscapes('"\\(x\\)"')).toBe('"\\\\(x\\\\)"');
    expect(fixInvalidJsonStringEscapes('"line\\nnext"')).toBe('"line\\nnext"');
    expect(fixInvalidJsonStringEscapes('"say \\"hi\\""')).toBe(
      '"say \\"hi\\""',
    );
  });

  it('truncates previews for logging', () => {
    const preview = jsonPreview('a'.repeat(400), 100);

    expect(preview.endsWith('…')).toBe(true);
    expect(preview.length).toBeLessThanOrEqual(101);
  });
});
