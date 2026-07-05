import { jsonPreview, salvageJson } from './json-salvage.util';

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

  it('truncates previews for logging', () => {
    const preview = jsonPreview('a'.repeat(400), 100);

    expect(preview.endsWith('…')).toBe(true);
    expect(preview.length).toBeLessThanOrEqual(101);
  });
});
