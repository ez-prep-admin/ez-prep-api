import { BadRequestException, NotFoundException } from '@nestjs/common';
import { S3Service } from './s3.service';
import { AwsConfigService } from '../config/aws.config';

const mockSend = jest.fn();
const mockGetSignedUrl = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({
      send: (...args: unknown[]) => mockSend(...args),
    })),
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}));

describe('S3Service', () => {
  const awsConfig = {
    region: 'ap-south-1',
    accessKeyId: 'test',
    secretAccessKey: 'test',
    s3Bucket: 'test-bucket',
    s3ImageBucket: 'test-image-bucket',
  } as AwsConfigService;

  let service: S3Service;

  beforeEach(() => {
    mockSend.mockReset();
    mockGetSignedUrl.mockReset();
    service = new S3Service(awsConfig);
  });

  describe('key generation', () => {
    it('scopes PDF keys under a unique upload id', () => {
      const first = service.generateQuestionUploadKey(
        '507f1f77bcf86cd799439011',
        'Flip test-25.pdf',
      );
      const second = service.generateQuestionUploadKey(
        '507f1f77bcf86cd799439012',
        'Flip test-25.pdf',
      );

      expect(first).toBe(
        'question-uploads/pdfs/507f1f77bcf86cd799439011/Flip_test-25.pdf',
      );
      expect(second).toBe(
        'question-uploads/pdfs/507f1f77bcf86cd799439012/Flip_test-25.pdf',
      );
      expect(first).not.toBe(second);
    });

    it('sanitizes unsafe path segments in upload keys', () => {
      expect(
        service.generateQuestionUploadKey('id/with spaces!', 'file name.pdf'),
      ).toBe('question-uploads/pdfs/id_with_spaces_/file_name.pdf');
    });

    it('scopes markdown keys under the upload id', () => {
      expect(
        service.generateQuestionMarkdownKey(
          '507f1f77bcf86cd799439011',
          'Flip test-25.md',
        ),
      ).toBe(
        'question-uploads/markdowns/507f1f77bcf86cd799439011/Flip_test-25.md',
      );
    });

    it('generates unique import image keys from upload and image ids', () => {
      const first = service.generateImportImageKey(
        '507f1f77bcf86cd799439011',
        '8ccd351c-921a-4143-913c-670d666ad371',
        'jpg',
      );
      const second = service.generateImportImageKey(
        '507f1f77bcf86cd799439011',
        'd4f643e1-3049-44b7-8fa6-38e58263ace3',
        'jpg',
      );

      expect(first).toBe(
        'question-imports/507f1f77bcf86cd799439011/8ccd351c-921a-4143-913c-670d666ad371.jpg',
      );
      expect(second).toBe(
        'question-imports/507f1f77bcf86cd799439011/d4f643e1-3049-44b7-8fa6-38e58263ace3.jpg',
      );
      expect(first).not.toBe(second);
    });

    it('strips non-alphanumeric extension characters and defaults empty ext to jpg', () => {
      expect(
        service.generateImportImageKey('upload-id', 'image-id', '.png!'),
      ).toBe('question-imports/upload-id/image-id.png');
      expect(service.generateImportImageKey('upload-id', 'image-id', '')).toBe(
        'question-imports/upload-id/image-id.jpg',
      );
    });
  });

  describe('uploadFile', () => {
    it('uploads with defaults when options are omitted', async () => {
      mockSend.mockResolvedValue({ ETag: '"etag-1"' });
      const file = Buffer.from('hello');

      const result = await service.uploadFile(file);

      expect(result.bucket).toBe('test-bucket');
      expect(result.region).toBe('ap-south-1');
      expect(result.contentType).toBe('application/octet-stream');
      expect(result.size).toBe(5);
      expect(result.etag).toBe('"etag-1"');
      expect(result.key).toMatch(/^uploads\/\d+-[a-z0-9]+\/file-[a-z0-9]+$/);
      expect(result.location).toBeUndefined();
      expect(mockSend).toHaveBeenCalled();
    });

    it('sets public-read location and tagging', async () => {
      mockSend.mockResolvedValue({ ETag: '"etag-2"' });
      const result = await service.uploadFile(Buffer.from('x'), {
        bucket: 'custom-bucket',
        key: 'path/file.txt',
        contentType: 'text/plain',
        acl: 'public-read',
        tags: { env: 'test', owner: 'qa' },
        metadata: { source: 'unit' },
      });

      expect(result.location).toBe(
        'https://custom-bucket.s3.ap-south-1.amazonaws.com/path/file.txt',
      );
      expect(result.key).toBe('path/file.txt');
      expect(result.contentType).toBe('text/plain');
    });

    it('uses empty etag when S3 omits ETag', async () => {
      mockSend.mockResolvedValue({});
      const result = await service.uploadFile(Buffer.from('x'), {
        key: 'k',
      });
      expect(result.etag).toBe('');
    });

    it('wraps Error upload failures as BadRequestException', async () => {
      mockSend.mockRejectedValue(new Error('network down'));
      await expect(
        service.uploadFile(Buffer.from('x'), { key: 'k' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.uploadFile(Buffer.from('x'), { key: 'k' }),
      ).rejects.toThrow(/network down/);
    });

    it('wraps non-Error upload failures as Unknown error', async () => {
      mockSend.mockRejectedValue('boom');
      await expect(
        service.uploadFile(Buffer.from('x'), { key: 'k' }),
      ).rejects.toThrow(/Unknown error/);
    });
  });

  describe('downloadFile', () => {
    it('downloads using default bucket and concatenates body chunks', async () => {
      mockSend.mockResolvedValue({
        Body: (async function* () {
          yield Buffer.from('hel');
          yield Buffer.from('lo');
        })(),
        ContentType: 'text/plain',
        ContentLength: 5,
        LastModified: new Date('2024-01-01'),
        ETag: '"e"',
        Metadata: { a: '1' },
      });

      const result = await service.downloadFile('my-key');
      expect(result.body.toString()).toBe('hello');
      expect(result.contentType).toBe('text/plain');
      expect(result.contentLength).toBe(5);
      expect(result.etag).toBe('"e"');
      expect(result.metadata).toEqual({ a: '1' });
    });

    it('falls back to body length when ContentLength is missing', async () => {
      mockSend.mockResolvedValue({
        Body: (async function* () {
          yield Buffer.from('abc');
        })(),
      });

      const result = await service.downloadFile('k', 'other-bucket', {
        range: 'bytes=0-2',
      });
      expect(result.contentLength).toBe(3);
    });

    it('rethrows NotFoundException when Body is missing', async () => {
      mockSend.mockResolvedValue({ Body: undefined });
      await expect(service.downloadFile('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('wraps other download errors as BadRequestException', async () => {
      mockSend.mockRejectedValue(new Error('denied'));
      await expect(service.downloadFile('k')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('wraps non-Error download failures', async () => {
      mockSend.mockRejectedValue(123);
      await expect(service.downloadFile('k')).rejects.toThrow(/Unknown error/);
    });
  });

  describe('deleteFile', () => {
    it('deletes using default bucket', async () => {
      mockSend.mockResolvedValue({ VersionId: 'v1' });
      const result = await service.deleteFile('k');
      expect(result).toEqual({ deleted: true, key: 'k', versionId: 'v1' });
    });

    it('deletes using an explicit bucket', async () => {
      mockSend.mockResolvedValue({});
      const result = await service.deleteFile('k', 'bkt');
      expect(result.deleted).toBe(true);
    });

    it('wraps Error delete failures', async () => {
      mockSend.mockRejectedValue(new Error('locked'));
      await expect(service.deleteFile('k')).rejects.toThrow(/locked/);
    });

    it('wraps non-Error delete failures', async () => {
      mockSend.mockRejectedValue({ fail: true });
      await expect(service.deleteFile('k')).rejects.toThrow(/Unknown error/);
    });
  });

  describe('listObjects', () => {
    it('lists objects with defaults and maps missing fields', async () => {
      mockSend.mockResolvedValue({
        Contents: [
          { Key: 'a.txt' },
          {
            Key: 'b.txt',
            Size: 10,
            LastModified: new Date('2024-02-02'),
            ETag: '"b"',
          },
        ],
        IsTruncated: true,
        NextContinuationToken: 'next',
        KeyCount: 2,
      });

      const result = await service.listObjects();
      expect(result.objects[0]).toMatchObject({
        key: 'a.txt',
        size: 0,
        etag: '',
        contentType: undefined,
      });
      expect(result.objects[1].size).toBe(10);
      expect(result.isTruncated).toBe(true);
      expect(result.nextContinuationToken).toBe('next');
      expect(result.keyCount).toBe(2);
    });

    it('returns empty objects when Contents is omitted', async () => {
      mockSend.mockResolvedValue({});
      const result = await service.listObjects(
        { prefix: 'p/', maxKeys: 5, continuationToken: 'tok' },
        'other',
      );
      expect(result.objects).toEqual([]);
      expect(result.isTruncated).toBe(false);
      expect(result.keyCount).toBe(0);
    });

    it('wraps Error list failures', async () => {
      mockSend.mockRejectedValue(new Error('timeout'));
      await expect(service.listObjects()).rejects.toThrow(/timeout/);
    });

    it('wraps non-Error list failures', async () => {
      mockSend.mockRejectedValue('nope');
      await expect(service.listObjects()).rejects.toThrow(/Unknown error/);
    });
  });

  describe('getPresignedUrl', () => {
    it('generates a URL with default expiry and logs when not quiet', async () => {
      mockGetSignedUrl.mockResolvedValue('https://signed.example/file');
      const result = await service.getPresignedUrl('k');
      expect(result.url).toBe('https://signed.example/file');
      expect(result.key).toBe('k');
      expect(result.bucket).toBe('test-bucket');
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('uses custom options including quiet and explicit bucket', async () => {
      mockGetSignedUrl.mockResolvedValue('https://signed.example/file');
      const result = await service.getPresignedUrl('k', 'bkt', {
        expiresIn: 60,
        quiet: true,
        responseContentType: 'image/png',
        responseContentDisposition: 'inline',
      });
      expect(result.bucket).toBe('bkt');
    });

    it('wraps Error presign failures', async () => {
      mockGetSignedUrl.mockRejectedValue(new Error('sign fail'));
      await expect(service.getPresignedUrl('k')).rejects.toThrow(/sign fail/);
    });

    it('wraps non-Error presign failures', async () => {
      mockGetSignedUrl.mockRejectedValue('bad');
      await expect(service.getPresignedUrl('k')).rejects.toThrow(
        /Unknown error/,
      );
    });
  });

  describe('objectExists', () => {
    it('returns true when head succeeds', async () => {
      mockSend.mockResolvedValue({});
      await expect(service.objectExists('k')).resolves.toBe(true);
    });

    it('returns false for NotFound name', async () => {
      mockSend.mockRejectedValue({ name: 'NotFound' });
      await expect(service.objectExists('k', 'bkt')).resolves.toBe(false);
    });

    it('returns false for 404 metadata', async () => {
      mockSend.mockRejectedValue({ $metadata: { httpStatusCode: 404 } });
      await expect(service.objectExists('k')).resolves.toBe(false);
    });

    it('rethrows unexpected head errors', async () => {
      mockSend.mockRejectedValue({ name: 'AccessDenied' });
      await expect(service.objectExists('k')).rejects.toEqual({
        name: 'AccessDenied',
      });
    });
  });
});
