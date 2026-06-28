import { Injectable } from '@nestjs/common';
import { BaseQuestionPaperParser } from '../base-question-paper-parser.service';
import { ParserConfiguration } from '../../types/parser-configuration';
import { MarkdownParserService } from '../markdown-parser.service';
import { QuestionParserService } from '../question-parser.service';
import { SolutionParserService } from '../solution-parser.service';
import { QuestionMatcherService } from '../question-matcher.service';
import { MathpixNeetQuestionBoundaryStrategy } from '../boundaries/mathpix-neet-question-boundary.strategy';
import { QuestionBoundaryStrategy } from '../boundaries/question-boundary.strategy';

@Injectable()
export class MathpixNeetParserStrategy extends BaseQuestionPaperParser {
  readonly configuration: ParserConfiguration = {
    parserName: 'mathpix-neet',
    markers: {
      solutionsHeader: '## SOLUTIONS',
    },
  };

  constructor(
    markdownParser: MarkdownParserService,
    questionParser: QuestionParserService,
    solutionParser: SolutionParserService,
    matcher: QuestionMatcherService,
    private readonly boundaryStrategy: MathpixNeetQuestionBoundaryStrategy,
  ) {
    super(markdownParser, questionParser, solutionParser, matcher);
  }

  supports(markdown: string): boolean {
    return markdown.includes(this.configuration.markers.solutionsHeader);
  }

  getBoundaryStrategy(): QuestionBoundaryStrategy {
    return this.boundaryStrategy;
  }
}
