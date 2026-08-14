import { Test, TestingModule } from '@nestjs/testing';
import { ImageUrlResolver } from './image-url.resolver';
import { S3Service } from './s3.service';
import { AwsConfigService } from '../config/aws.config';

describe('ImageUrlResolver', () => {
  let resolver: ImageUrlResolver;
  const mockS3 = {
    getPresignedUrl: jest.fn(),
  };
  const mockAwsConfig = {
    allowedImageBuckets: ['image-bucket'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImageUrlResolver,
        { provide: S3Service, useValue: mockS3 },
        { provide: AwsConfigService, useValue: mockAwsConfig },
      ],
    }).compile();

    resolver = module.get(ImageUrlResolver);
    jest.clearAllMocks();
  });

  describe('resolve', () => {
    it('should return a signed url for allowed keys', async () => {
      mockS3.getPresignedUrl.mockResolvedValue({ url: 'https://signed' });

      await expect(
        resolver.resolve({
          key: 'admin-images/a.jpg',
          bucket: 'image-bucket',
        }),
      ).resolves.toBe('https://signed');

      expect(mockS3.getPresignedUrl).toHaveBeenCalledWith(
        'admin-images/a.jpg',
        'image-bucket',
        { expiresIn: 3600, quiet: true },
      );
    });

    it('should fall back to https url when signing fails', async () => {
      mockS3.getPresignedUrl.mockRejectedValue(new Error('sign fail'));

      await expect(
        resolver.resolve({
          key: 'admin-images/a.jpg',
          bucket: 'image-bucket',
          url: 'https://cdn.example/a.jpg',
        }),
      ).resolves.toBe('https://cdn.example/a.jpg');
    });

    it('should stringify non-Error signing failures', async () => {
      mockS3.getPresignedUrl.mockRejectedValue('nope');

      await expect(
        resolver.resolve({
          key: 'admin-images/a.jpg',
          bucket: 'image-bucket',
          url: 'https://ok',
        }),
      ).resolves.toBe('https://ok');
    });

    it('should skip signing for disallowed keys or buckets', async () => {
      await expect(
        resolver.resolve({
          key: 'secret/a.jpg',
          bucket: 'image-bucket',
          url: 'https://fallback',
        }),
      ).resolves.toBe('https://fallback');
      expect(mockS3.getPresignedUrl).not.toHaveBeenCalled();

      await expect(
        resolver.resolve({
          key: 'admin-images/a.jpg',
          bucket: 'other',
          url: 'https://fallback',
        }),
      ).resolves.toBe('https://fallback');
    });

    it('should reject non-https or overly long urls', async () => {
      await expect(
        resolver.resolve({ url: 'http://insecure' }),
      ).resolves.toBeNull();
      await expect(
        resolver.resolve({ url: `https://${'a'.repeat(2048)}` }),
      ).resolves.toBeNull();
      await expect(resolver.resolve(null)).resolves.toBeNull();
      await expect(resolver.resolve(undefined)).resolves.toBeNull();
    });
  });

  describe('resolveMany', () => {
    it('should resolve, cache, and skip empty cache keys', async () => {
      mockS3.getPresignedUrl.mockResolvedValue({ url: 'https://signed' });
      const image = {
        key: 'admin-images/a.jpg',
        bucket: 'image-bucket',
      };

      const result = await resolver.resolveMany([
        image,
        image,
        { url: 'https://other' },
        {},
        null,
      ]);

      expect(result).toEqual([
        'https://signed',
        'https://signed',
        'https://other',
        null,
        null,
      ]);
      expect(mockS3.getPresignedUrl).toHaveBeenCalledTimes(1);
    });
  });
});
