import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { FilesController } from './files.controller';
import { S3Service } from './s3/s3.service';
import { AwsConfigService } from './config/aws.config';

const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('FilesController', () => {
  let controller: FilesController;
  const mockS3 = {
    uploadFile: jest.fn(),
    getPresignedUrl: jest.fn(),
  };
  const mockAwsConfig = {
    s3ImageBucket: 'image-bucket',
    allowedImageBuckets: ['image-bucket'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        { provide: S3Service, useValue: mockS3 },
        { provide: AwsConfigService, useValue: mockAwsConfig },
      ],
    }).compile();

    controller = module.get(FilesController);
    jest.clearAllMocks();
  });

  describe('upload', () => {
    it('should reject missing files', async () => {
      await expect(controller.upload(undefined)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should reject buffers that are not jpeg or png', async () => {
      await expect(
        controller.upload({ buffer: Buffer.from([1, 2, 3]) } as any),
      ).rejects.toThrow('Only JPEG and PNG images are allowed');
    });

    it('should upload jpeg files', async () => {
      mockS3.uploadFile.mockResolvedValue({
        key: 'admin-images/1.jpg',
        bucket: 'image-bucket',
        region: 'us-east-1',
        contentType: 'image/jpeg',
        size: 4,
        uploadedAt: new Date('2024-01-01'),
      });
      mockS3.getPresignedUrl.mockResolvedValue({ url: 'https://signed' });

      const result = await controller.upload({
        buffer: jpegBuffer,
      } as any);

      expect(mockS3.uploadFile).toHaveBeenCalledWith(
        jpegBuffer,
        expect.objectContaining({
          bucket: 'image-bucket',
          contentType: 'image/jpeg',
        }),
      );
      expect(result.message).toBe('File uploaded successfully');
      expect(result.data.url).toBe('https://signed');
      expect(result.data.key).toMatch(/^admin-images\/.+\.jpg$/);
    });

    it('should upload png files', async () => {
      mockS3.uploadFile.mockResolvedValue({
        key: 'admin-images/1.png',
        bucket: 'image-bucket',
        region: 'us-east-1',
        contentType: 'image/png',
        size: 8,
        uploadedAt: new Date('2024-01-01'),
      });
      mockS3.getPresignedUrl.mockResolvedValue({ url: 'https://png' });

      const result = await controller.upload({ buffer: pngBuffer } as any);

      expect(mockS3.uploadFile).toHaveBeenCalledWith(
        pngBuffer,
        expect.objectContaining({ contentType: 'image/png' }),
      );
      expect(result.data.contentType).toBe('image/png');
    });
  });

  describe('signedUrl', () => {
    it('should generate a signed url for allowed keys', async () => {
      mockS3.getPresignedUrl.mockResolvedValue({ url: 'https://get' });

      const result = await controller.signedUrl({
        key: 'admin-images/a.jpg',
        bucket: 'image-bucket',
      });

      expect(result).toEqual({
        message: 'Signed URL generated successfully',
        data: { url: 'https://get' },
      });
    });

    it('should reject unsafe keys', async () => {
      await expect(
        controller.signedUrl({ key: '../x', bucket: 'image-bucket' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
