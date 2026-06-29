import { BadRequestException, Injectable } from '@nestjs/common';
import { ParsedDocument } from '../types/parsed-document';
import { DocumentMarkers } from '../types/document-markers';

@Injectable()
export class MarkdownParserService {
  parse(markdown: string, markers: DocumentMarkers): ParsedDocument {
    const normalized = this.normalize(markdown);

    // Inline solutions: treat the full document as the questions section
    if (!markers.solutionsHeader) {
      return {
        rawMarkdown: normalized,
        questionsSection: normalized,
        solutionsSection: '',
      };
    }

    const splitIndex = normalized.indexOf(markers.solutionsHeader);

    if (splitIndex === -1) {
      throw new BadRequestException(
        `Solutions header "${markers.solutionsHeader}" not found.`,
      );
    }

    const questionsSection = normalized.substring(0, splitIndex).trim();
    let solutionsSection = normalized.substring(splitIndex).trim();

    solutionsSection = solutionsSection
      .replace(
        new RegExp(`^${this.escapeRegExp(markers.solutionsHeader)}\\s*`),
        '',
      )
      .trim();

    return {
      rawMarkdown: normalized,
      questionsSection,
      solutionsSection,
    };
  }

  private normalize(markdown: string): string {
    return markdown.replace(/\r\n/g, '\n').replace(/\t/g, ' ').trim();
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
