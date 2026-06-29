import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AwsConfigService } from './config/aws.config';
import { S3Service } from './s3/s3.service';

/**
 * AWS Module - Generic AWS services integration
 * Provides S3 and other AWS services across the application
 * 
 * @Global decorator makes this module available everywhere without re-importing
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [AwsConfigService, S3Service],
  exports: [AwsConfigService, S3Service],
})
export class AwsModule {
  constructor(private readonly awsConfig: AwsConfigService) {
    // Validate AWS configuration on module initialization
    this.awsConfig.validateConfig();
  }
}
