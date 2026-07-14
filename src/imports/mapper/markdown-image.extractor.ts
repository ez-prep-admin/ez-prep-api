import { Injectable } from '@nestjs/common';
import {
  EXTERNAL_IMAGE_REGION,
  ImportImageMetadata,
  MATHPIX_PENDING_BUCKET,
} from '../types/import-image-metadata';
import {
  preferMathFaithfulText,
  stripQuestionStemMetadata,
} from '../utils/latex-fidelity.util';

export interface ExtractedMarkdownContent {
  text: string;
  image: ImportImageMetadata | null;
}

@Injectable()
export class MarkdownImageExtractorService {
  private static readonly MARKDOWN_IMAGE_REGEX =
    /!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/g;

  extractFromText(text: string): ExtractedMarkdownContent {
    const urls: string[] = [];

    const withoutImages = text
      .replace(MarkdownImageExtractorService.MARKDOWN_IMAGE_REGEX, (_, url) => {
        urls.push(url);
        return '';
      })
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return {
      text: withoutImages,
      image: urls[0] ? this.toImageMetadata(urls[0]) : null,
    };
  }

  /**
   * Builds question content by cleaning AI text and preferring images
   * found in the original parsed markdown block (authoritative source).
   * When the LLM strips Mathpix/LaTeX delimiters, prefer the source stem.
   */
  buildQuestionContent(
    aiQuestionText: string,
    sourceQuestionBlock?: string,
  ): ExtractedMarkdownContent {
    const aiContent = this.extractFromText(aiQuestionText);
    const sourceStemContent = sourceQuestionBlock
      ? this.extractFromText(this.stripOptionSections(sourceQuestionBlock))
      : { text: '', image: null };
    const postOptionContent = sourceQuestionBlock
      ? this.extractPostOptionContent(sourceQuestionBlock)
      : { text: '', image: null };

    const image =
      sourceStemContent.image ?? postOptionContent.image ?? aiContent.image;

    const sourceStem = stripQuestionStemMetadata(sourceStemContent.text);
    let text = preferMathFaithfulText(aiContent.text, sourceStem);
    if (!text) {
      text = aiContent.text || sourceStem;
    }

    if (image && !text.includes('Fig.')) {
      const captionMatch =
        sourceQuestionBlock?.match(/Fig\.\s*[\d.]+/) ??
        postOptionContent.text.match(/Fig\.\s*[\d.]+/);
      if (captionMatch) {
        text = `${text}\n${captionMatch[0]}`.trim();
      }
    }

    return { text, image };
  }

  buildExplanationContent(
    aiExplanationText: string,
    sourceSolutionBlock?: string,
  ): ExtractedMarkdownContent {
    const aiContent = this.extractFromText(aiExplanationText);
    const sourceContent = sourceSolutionBlock
      ? this.extractFromText(sourceSolutionBlock)
      : { text: '', image: null };

    // Explanations are intentionally rewritten by the LLM.
    return {
      text: aiContent.text || sourceContent.text,
      image: sourceContent.image ?? aiContent.image,
    };
  }

  extractOptionContent(
    sourceQuestionBlock: string,
    label: string,
  ): ExtractedMarkdownContent {
    const pattern = new RegExp(
      `\\(${label}\\)\\s*([\\s\\S]*?)(?=\\n\\s*\\([a-d]\\)\\s|\\n\\s*\\n\\s*!\\[|\\n\\s*\\n\\s*Fig\\.|$)`,
      'i',
    );
    const match = sourceQuestionBlock.match(pattern);

    if (!match?.[1]) {
      return { text: '', image: null };
    }

    return this.extractFromText(match[1].trim());
  }

  /**
   * Mathpix often places shared diagrams after the option list (e.g. Fig. 19.1).
   * That content belongs on the question stem, not the last option.
   */
  private extractPostOptionContent(markdown: string): ExtractedMarkdownContent {
    const optionLines = markdown.match(/(?:^|\n)\s*\([a-d]\)\s*[^\n]*/gim);
    if (!optionLines?.length) {
      return { text: '', image: null };
    }

    const lastOptionLine = optionLines[optionLines.length - 1];
    const lastIndex = markdown.lastIndexOf(lastOptionLine);
    if (lastIndex === -1) {
      return { text: '', image: null };
    }

    const trailing = markdown.slice(lastIndex + lastOptionLine.length).trim();
    return this.extractFromText(trailing);
  }

  /**
   * Removes option lines so stem extraction does not pick up option images.
   */
  private stripOptionSections(markdown: string): string {
    const optionStart = markdown.search(/\n\s*\([a-d]\)\s/i);
    if (optionStart === -1) {
      return markdown;
    }

    return markdown.slice(0, optionStart).trim();
  }

  toImageMetadata(url: string): ImportImageMetadata {
    const parsedUrl = new URL(url);
    const key = parsedUrl.pathname.replace(/^\//, '');
    const extension = key.split('.').pop()?.toLowerCase() ?? 'jpg';

    return {
      key,
      bucket: MATHPIX_PENDING_BUCKET,
      region: EXTERNAL_IMAGE_REGION,
      contentType: this.inferContentType(extension),
      url,
    };
  }

  private inferContentType(extension: string): string {
    switch (extension) {
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'jpg':
      case 'jpeg':
      default:
        return 'image/jpeg';
    }
  }
}
