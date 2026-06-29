import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { S3Service } from '../../aws/s3/s3.service';
import { AwsConfigService } from '../../aws/config/aws.config';
import { ImportQuestion } from '../types/import-question';
import {
  ImportImageMetadata,
  isPendingImportImage,
} from '../types/import-image-metadata';

export interface ImageMaterializeContext {
  uploadId?: string;
  questionNumber: number;
}

const DEFAULT_PRESIGNED_TTL_SECONDS = 86_400; // 24 hours
const IMAGE_DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

export class ImportImageMaterializeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportImageMaterializeError';
  }
}

@Injectable()
export class ImportImageStorageService {
  private readonly logger = new Logger(ImportImageStorageService.name);
  private readonly imageBucket: string;
  private readonly region: string;

  /** Dedupes repeated source URLs within a single enrich request */
  private readonly sessionCache = new Map<string, ImportImageMetadata>();

  constructor(
    private readonly s3Service: S3Service,
    private readonly awsConfig: AwsConfigService,
  ) {
    this.imageBucket = this.awsConfig.s3ImageBucket;
    this.region = this.awsConfig.region;
  }

  clearSessionCache(): void {
    this.sessionCache.clear();
  }

  /**
   * Download external images and store them in AWS_S3_IMAGE_BUCKET.
   * Updates questionText, explanation, and option image metadata in place.
   */
  async materializeQuestionImages(
    question: ImportQuestion,
    context: ImageMaterializeContext,
  ): Promise<ImportQuestion> {
    const questionTextImage = question.questionText.en.image;
    const explanationImage = question.explanation.image;

    const [resolvedQuestionImage, resolvedExplanationImage, resolvedOptions] =
      await Promise.all([
        questionTextImage
          ? this.materializeImage(questionTextImage, context, 'question-stem')
          : Promise.resolve(null),
        explanationImage
          ? this.materializeImage(explanationImage, context, 'explanation')
          : Promise.resolve(null),
        this.materializeOptionImages(question.options, context),
      ]);

    return {
      ...question,
      questionText: {
        ...question.questionText,
        en: {
          ...question.questionText.en,
          image: resolvedQuestionImage,
        },
      },
      options: resolvedOptions,
      explanation: {
        ...question.explanation,
        image: resolvedExplanationImage,
      },
    };
  }

  private async materializeOptionImages(
    options: ImportQuestion['options'],
    context: ImageMaterializeContext,
  ): Promise<ImportQuestion['options']> {
    return Promise.all(
      options.map(async option => {
        if (!option.image) {
          return option;
        }

        const image = await this.materializeImage(
          option.image,
          context,
          `option-${option.id}`,
        );

        return {
          ...option,
          type: 'image' as const,
          image,
        };
      }),
    );
  }

  private async materializeImage(
    image: ImportImageMetadata,
    context: ImageMaterializeContext,
    slot: string,
  ): Promise<ImportImageMetadata> {
    if (!isPendingImportImage(image)) {
      return this.refreshPresignedUrl(image);
    }

    const sourceUrl = image.url?.trim();
    if (!sourceUrl) {
      throw new ImportImageMaterializeError(
        `Pending image for question ${context.questionNumber} (${slot}) is missing a source URL.`,
      );
    }

    const cached = this.sessionCache.get(sourceUrl);
    if (cached) {
      return cached;
    }

    const uploadId = context.uploadId ?? 'standalone';
    const extension = this.inferExtension(sourceUrl, image.contentType);
    const key = this.s3Service.generateImportImageKey(
      uploadId,
      context.questionNumber,
      slot,
      extension,
      sourceUrl,
    );

    let size = image.size;

    if (!(await this.s3Service.objectExists(key, this.imageBucket))) {
      const buffer = await this.downloadImage(sourceUrl);
      size = buffer.length;

      await this.s3Service.uploadFile(buffer, {
        key,
        bucket: this.imageBucket,
        contentType: image.contentType ?? this.inferContentType(extension),
        metadata: {
          sourceUrl,
          uploadId,
          questionNumber: String(context.questionNumber),
          slot,
        },
        tags: {
          type: 'import-image',
          source: 'mathpix',
        },
      });

      this.logger.log(
        `[import-image] Uploaded ${key} (${size} bytes) for question ${context.questionNumber}`,
      );
    } else {
      this.logger.debug(
        `[import-image] Reusing existing object ${key} for question ${context.questionNumber}`,
      );
    }

    const stored = await this.buildStoredMetadata(
      key,
      size,
      image.contentType ?? this.inferContentType(extension),
    );

    this.sessionCache.set(sourceUrl, stored);
    return stored;
  }

  private async refreshPresignedUrl(
    image: ImportImageMetadata,
  ): Promise<ImportImageMetadata> {
    if (image.bucket !== this.imageBucket) {
      return image;
    }

    const presigned = await this.s3Service.getPresignedUrl(
      image.key,
      image.bucket,
      {
        expiresIn: DEFAULT_PRESIGNED_TTL_SECONDS,
        responseContentType: image.contentType,
      },
    );

    return {
      ...image,
      region: this.region,
      url: presigned.url,
    };
  }

  private async buildStoredMetadata(
    key: string,
    size: number | undefined,
    contentType: string,
  ): Promise<ImportImageMetadata> {
    const presigned = await this.s3Service.getPresignedUrl(
      key,
      this.imageBucket,
      {
        expiresIn: DEFAULT_PRESIGNED_TTL_SECONDS,
        responseContentType: contentType,
      },
    );

    return {
      key,
      bucket: this.imageBucket,
      region: this.region,
      contentType,
      size,
      lastModified: new Date(),
      url: presigned.url,
    };
  }

  private async downloadImage(url: string): Promise<Buffer> {
    try {
      const response = await axios.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        timeout: IMAGE_DOWNLOAD_TIMEOUT_MS,
        maxContentLength: MAX_IMAGE_BYTES,
        maxBodyLength: MAX_IMAGE_BYTES,
        validateStatus: status => status >= 200 && status < 300,
      });

      return Buffer.from(response.data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown download error';
      throw new ImportImageMaterializeError(
        `Failed to download image from ${url}: ${message}`,
      );
    }
  }

  private inferExtension(url: string, contentType?: string): string {
    if (contentType) {
      if (contentType.includes('png')) return 'png';
      if (contentType.includes('gif')) return 'gif';
      if (contentType.includes('webp')) return 'webp';
    }

    const pathname = new URL(url).pathname;
    const ext = pathname.split('.').pop()?.toLowerCase();
    if (ext && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      return ext === 'jpeg' ? 'jpg' : ext;
    }

    return 'jpg';
  }

  private inferContentType(extension: string): string {
    switch (extension) {
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  }
}
