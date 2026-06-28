import { Injectable } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { DocumentParserFactory } from './parser/factories/document-parser.factory';
import { MatchedQuestion } from './types/matched-question';
import { ParsedDocument } from './types/parsed-document';
import { ParserWarning } from './types/parser-result';
import { MarkdownParserService } from './parser/markdown-parser.service';

export interface ParseDebugResult {
  parserName: string;
  document: ParsedDocument;
  matchedQuestions: MatchedQuestion[];
  warnings: ParserWarning[];
  stats: {
    questionCount: number;
    solutionCount: number;
    matchedCount: number;
  };
}

@Injectable()
export class ImportService {
  private static readonly FLIP_TEST_MARKDOWN_PATH = join(
    process.cwd(),
    'test/test_data/Flip test-25.md',
  );

  constructor(
    private readonly documentParserFactory: DocumentParserFactory,
    private readonly markdownParser: MarkdownParserService,
  ) {}

  async parseMarkdown(markdown: string): Promise<ParseDebugResult> {
    const parser = this.documentParserFactory.getParser(markdown);
    const document = this.markdownParser.parse(
      markdown,
      parser.configuration.markers,
    );
    const result = await parser.parseWithResult(markdown);

    return {
      parserName: parser.configuration.parserName,
      document,
      matchedQuestions: result.data,
      warnings: result.warnings,
      stats: {
        questionCount: result.data.length,
        solutionCount: result.data.filter(item => item.solution).length,
        matchedCount: result.data.filter(item => item.solution).length,
      },
    };
  }

  async parseFlipTestSample(): Promise<ParseDebugResult> {
    const markdown = await readFile(
      ImportService.FLIP_TEST_MARKDOWN_PATH,
      'utf-8',
    );
    return this.parseMarkdown(markdown);
  }
}
