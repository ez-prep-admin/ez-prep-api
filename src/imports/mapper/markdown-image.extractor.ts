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
import { looksLikeSolutionTrailing } from '../parser/orphan-solution-reattach.util';

export interface ExtractedMarkdownContent {
  text: string;
  /** Primary image (first). Kept for backward-compatible consumers. */
  image: ImportImageMetadata | null;
  /** All extracted images in document order. */
  images: ImportImageMetadata[];
}

@Injectable()
export class MarkdownImageExtractorService {
  private static readonly MARKDOWN_IMAGE_REGEX =
    /!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/g;

  /** Mathpix MMD often embeds figures as LaTeX includegraphics, not ![](). */
  private static readonly INCLUDEGRAPHICS_REGEX =
    /\\includegraphics(?:\[[^\]]*\])?\{(https?:\/\/[^}\s]+)\}/g;

  extractFromText(text: string): ExtractedMarkdownContent {
    const urls: string[] = [];

    const withoutImages = text
      .replace(
        MarkdownImageExtractorService.INCLUDEGRAPHICS_REGEX,
        (_, url: string) => {
          urls.push(url);
          return '';
        },
      )
      .replace(
        MarkdownImageExtractorService.MARKDOWN_IMAGE_REGEX,
        (_, url: string) => {
          urls.push(url);
          return '';
        },
      )
      // Keep human-readable captions; drop LaTeX figure wrappers/noise.
      .replace(/\\caption(?:\[[^\]]*\])?\{([^}]*)\}/g, '$1')
      .replace(/\\captionsetup\{[^}]*\}/g, '')
      .replace(/\\begin\{figure\}/g, '')
      .replace(/\\end\{figure\}/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const images = this.uniqueImages(
      urls.map(url => this.toImageMetadata(url)),
    );

    return {
      text: withoutImages,
      image: images[0] ?? null,
      images,
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
      : { text: '', image: null, images: [] as ImportImageMetadata[] };
    const postOptionContent = sourceQuestionBlock
      ? this.extractPostOptionContent(sourceQuestionBlock)
      : { text: '', image: null, images: [] as ImportImageMetadata[] };

    // Do not treat solution-like trailing (Short Trick etc.) as stem diagrams.
    const postOptionImages = looksLikeSolutionTrailing(
      this.rawPostOptionTrailing(sourceQuestionBlock ?? ''),
    )
      ? []
      : postOptionContent.images;

    const images = this.uniqueImages([
      ...sourceStemContent.images,
      ...postOptionImages,
      ...aiContent.images,
    ]);

    const sourceStem = stripQuestionStemMetadata(sourceStemContent.text);
    let text = preferMathFaithfulText(aiContent.text, sourceStem);
    if (!text) {
      text = aiContent.text || sourceStem;
    }

    if (images.length > 0 && !text.includes('Fig.')) {
      const captionMatch =
        sourceQuestionBlock?.match(/Fig\.\s*[\d.]+/) ??
        postOptionContent.text.match(/Fig\.\s*[\d.]+/);
      if (captionMatch) {
        text = `${text}\n${captionMatch[0]}`.trim();
      }
    }

    return { text, image: images[0] ?? null, images };
  }

  buildExplanationContent(
    aiExplanationText: string,
    sourceSolutionBlock?: string,
  ): ExtractedMarkdownContent {
    const aiContent = this.extractFromText(aiExplanationText);
    const sourceContent = sourceSolutionBlock
      ? this.extractFromText(sourceSolutionBlock)
      : { text: '', image: null, images: [] as ImportImageMetadata[] };

    const images = this.uniqueImages([
      ...sourceContent.images,
      ...aiContent.images,
    ]);

    // Explanations are intentionally rewritten by the LLM.
    return {
      text: aiContent.text || sourceContent.text,
      image: images[0] ?? null,
      images,
    };
  }

  extractOptionContent(
    sourceQuestionBlock: string,
    label: string,
  ): ExtractedMarkdownContent {
    const pattern = new RegExp(
      `\\(${label}\\)\\s*([\\s\\S]*?)(?=\\n\\s*\\([a-d]\\)\\s|\\n\\s*\\n\\s*!\\[|\\n\\s*\\\\begin\\{figure\\}|\\n\\s*\\n\\s*Fig\\.|$)`,
      'i',
    );
    const match = sourceQuestionBlock.match(pattern);

    if (!match?.[1]) {
      return { text: '', image: null, images: [] };
    }

    return this.extractFromText(match[1].trim());
  }

  /**
   * Mathpix often places shared diagrams after the option list (e.g. Fig. 19.1).
   * That content belongs on the question stem, not the last option.
   */
  private extractPostOptionContent(markdown: string): ExtractedMarkdownContent {
    const trailing = this.rawPostOptionTrailing(markdown);
    if (!trailing) {
      return { text: '', image: null, images: [] };
    }

    return this.extractFromText(trailing);
  }

  private rawPostOptionTrailing(markdown: string): string {
    if (!markdown) {
      return '';
    }

    const optionLines = markdown.match(/(?:^|\n)\s*\([a-d]\)\s*[^\n]*/gim);
    if (!optionLines?.length) {
      return '';
    }

    const lastOptionLine = optionLines[optionLines.length - 1];
    const lastIndex = markdown.lastIndexOf(lastOptionLine);
    if (lastIndex === -1) {
      return '';
    }

    return markdown.slice(lastIndex + lastOptionLine.length).trim();
  }

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

  private uniqueImages(images: ImportImageMetadata[]): ImportImageMetadata[] {
    const seen = new Set<string>();
    const unique: ImportImageMetadata[] = [];
    for (const image of images) {
      const key = image.url ?? `${image.bucket}/${image.key}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      unique.push(image);
    }
    return unique;
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
