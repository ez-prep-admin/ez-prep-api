import { readFileSync } from 'fs';
import { join } from 'path';
import { parseNumberedBlocks } from './numbered-block.parser';
import { MathpixNeetQuestionBoundaryStrategy } from './boundaries/mathpix-neet-question-boundary.strategy';
import { MarkdownParserService } from './markdown-parser.service';
import { QuestionMatcherService } from './question-matcher.service';

describe('Mathpix NEET parser (Flip test-25)', () => {
  const boundary = new MathpixNeetQuestionBoundaryStrategy();
  const markdownParser = new MarkdownParserService();
  const matcher = new QuestionMatcherService();

  const markdown = readFileSync(
    join(process.cwd(), 'test/test_data/Flip test-25.md'),
    'utf-8',
  );

  const markers = { solutionsHeader: '## SOLUTIONS' };
  const document = markdownParser.parse(markdown, markers);
  const questions = parseNumberedBlocks(document.questionsSection, boundary);
  const solutions = parseNumberedBlocks(document.solutionsSection, boundary);
  const { matched, warnings } = matcher.matchWithWarnings(questions, solutions);

  it('splits questions and solutions sections', () => {
    expect(document.questionsSection).toContain('PHYSICS 1 TO 25');
    expect(document.questionsSection).not.toContain('## SOLUTIONS');
    expect(document.solutionsSection).toContain(
      'Since an alpha particle and the nucleus',
    );
    expect(document.solutionsSection).not.toContain('## SOLUTIONS');
  });

  it('extracts 20 numbered questions', () => {
    expect(questions).toHaveLength(20);
    expect(questions.map(question => question.number)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
  });

  it('extracts 20 numbered solutions', () => {
    expect(solutions).toHaveLength(20);
    expect(solutions.map(solution => solution.number)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
  });

  it('keeps multi-line question content together', () => {
    const question1 = questions.find(question => question.number === 1);
    const question8 = questions.find(question => question.number === 8);

    expect(question1?.content).toContain('Fig. 19.1');
    expect(question1?.content).toContain('(d) 4');
    expect(question8?.content).toContain('$$');
    expect(question8?.content).toContain('neutron');
  });

  it('keeps multi-line solution content together', () => {
    const solution17 = solutions.find(solution => solution.number === 17);
    const solution20 = solutions.find(solution => solution.number === 20);

    expect(solution17?.content).toContain('| Reaction |');
    expect(solution17?.content).toContain('reaction (c) releases energy');
    expect(solution20?.content).toContain('m v+\\frac{E_{3}-E_{1}}{c}');
    expect(solution20?.content).toContain('correct choice is (b)');
  });

  it('matches every question to its solution without warnings', () => {
    expect(matched).toHaveLength(20);
    expect(warnings).toHaveLength(0);
    expect(matched.every(item => item.solution)).toBe(true);
  });
});
