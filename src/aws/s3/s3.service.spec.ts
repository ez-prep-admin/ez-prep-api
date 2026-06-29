import { S3Service } from './s3.service';
import { AwsConfigService } from '../config/aws.config';

describe('S3Service key generation', () => {
  const awsConfig = {
    region: 'ap-south-1',
    accessKeyId: 'test',
    secretAccessKey: 'test',
    s3Bucket: 'test-bucket',
    s3ImageBucket: 'test-image-bucket',
  } as AwsConfigService;

  const service = new S3Service(awsConfig);

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
});
