import { Injectable, Logger } from '@nestjs/common';
import { AwsConfigService } from '../config/aws.config';
import { S3Service } from './s3.service';
import { isSafeImageKey } from './s3-access.util';

export type ImageLike =
  | {
      key?: string;
      bucket?: string;
      url?: string;
    }
  | null
  | undefined;

@Injectable()
export class ImageUrlResolver {
  private readonly logger = new Logger(ImageUrlResolver.name);

  constructor(
    private readonly s3Service: S3Service,
    private readonly awsConfig: AwsConfigService,
  ) {}

  async resolve(image: ImageLike): Promise<string | null> {
    if (image?.key && image.bucket && this.isAllowed(image.key, image.bucket)) {
      try {
        const signed = await this.s3Service.getPresignedUrl(
          image.key,
          image.bucket,
          { expiresIn: 3600, quiet: true },
        );
        return signed.url;
      } catch (error) {
        this.logger.warn(
          `Failed to sign image ${image.bucket}/${image.key}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    if (
      typeof image?.url === 'string' &&
      image.url.startsWith('https://') &&
      image.url.length < 2048
    ) {
      return image.url;
    }

    return null;
  }

  async resolveMany(images: ImageLike[]): Promise<(string | null)[]> {
    const cache = new Map<string, Promise<string | null>>();

    return Promise.all(
      images.map(image => {
        const cacheKey =
          image?.key && image.bucket
            ? `${image.bucket}/${image.key}`
            : image?.url || '';
        if (!cacheKey) {
          return Promise.resolve(null);
        }
        let pending = cache.get(cacheKey);
        if (!pending) {
          pending = this.resolve(image);
          cache.set(cacheKey, pending);
        }
        return pending;
      }),
    );
  }

  private isAllowed(key: string, bucket: string): boolean {
    return (
      isSafeImageKey(key) && this.awsConfig.allowedImageBuckets.includes(bucket)
    );
  }
}
