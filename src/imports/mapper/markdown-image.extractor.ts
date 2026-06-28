import { Injectable } from '@nestjs/common';
import {
  EXTERNAL_IMAGE_REGION,
  ImportImageMetadata,
  MATHPIX_PENDING_BUCKET,
} from '../types/import-image-metadata';

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
   */
  buildQuestionContent(
    aiQuestionText: string,
    sourceQuestionBlock?: string,
  ): ExtractedMarkdownContent {
    const aiContent = this.extractFromText(aiQuestionText);
    const sourceContent = sourceQuestionBlock
      ? this.extractFromText(sourceQuestionBlock)
      : { text: '', image: null };

    const image = sourceContent.image ?? aiContent.image;
    let text = aiContent.text || sourceContent.text;

    if (image && !text.includes('Fig.')) {
      const captionMatch = sourceQuestionBlock?.match(/Fig\.\s*[\d.]+/);
      if (captionMatch) {
        text = `${text}\n${captionMatch[0]}`.trim();
      }
    }

    return { text, image };
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
