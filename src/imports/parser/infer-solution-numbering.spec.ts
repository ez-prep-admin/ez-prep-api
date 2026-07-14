import { inferSolutionNumberingRegex } from './infer-solution-numbering';

describe('inferSolutionNumberingRegex', () => {
  it('detects plain numbered answer lines', () => {
    const section = `
1. (2) First answer
2. (4) Second answer
3. (2) Third answer
`.trim();

    expect(inferSolutionNumberingRegex(section)).toEqual({
      regex: '^(\\d+)\\s*\\.\\s',
      type: 'numbered',
      exampleLine: '1. (2) First answer',
    });
  });

  it('detects Q-heading answer lines when present', () => {
    const section = `
## Q1. Solution text
## Q2. More solution
## Q3. Final
`.trim();

    expect(inferSolutionNumberingRegex(section)?.regex).toBe(
      '^## Q(\\d+)\\.\\s',
    );
  });

  it('detects Sol.N answer lines', () => {
    const section = `
Sol.48.(d) First
Sol.49.(c) Second
Sol.50.(a) Third
`.trim();

    expect(inferSolutionNumberingRegex(section)).toEqual({
      regex: '^Sol\\.(\\d+)\\.',
      type: 'labeled',
      exampleLine: 'Sol.48.(d) First',
    });
  });
});
