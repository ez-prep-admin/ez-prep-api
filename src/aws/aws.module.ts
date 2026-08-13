import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AwsConfigService } from './config/aws.config';
import { S3Service } from './s3/s3.service';
import { ImageUrlResolver } from './s3/image-url.resolver';
import { FilesController } from './files.controller';

/**
 * AWS Module - Generic AWS services integration
 * Provides S3 and other AWS services across the application
 *
 * @Global decorator makes this module available everywhere without re-importing
 */
@Global()
@Module({
  imports: [ConfigModule],
  controllers: [FilesController],
  providers: [AwsConfigService, S3Service, ImageUrlResolver],
  exports: [AwsConfigService, S3Service, ImageUrlResolver],
})
export class AwsModule {
  constructor(private readonly awsConfig: AwsConfigService) {
    // Validate AWS configuration on module initialization
    this.awsConfig.validateConfig();
  }
}
