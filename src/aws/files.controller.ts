import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { S3Service } from './s3/s3.service';
import { AwsConfigService } from './config/aws.config';
import { SignedUrlDto } from './dto/signed-url.dto';
import { assertAllowedBucket, assertSafeImageKey } from './s3/s3-access.util';
import { randomUUID } from 'crypto';

@ApiTags('files')
@Controller('files')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Admin privileges required' })
export class FilesController {
  constructor(
    private readonly s3Service: S3Service,
    private readonly awsConfig: AwsConfigService,
  ) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
          callback(
            new BadRequestException('Only JPEG and PNG images are allowed'),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload an image for questions (Admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  async upload(@UploadedFile() file?: Express.Multer.File): Promise<{
    message: string;
    data: {
      key: string;
      bucket: string;
      region: string;
      contentType: string;
      size: number;
      lastModified: Date;
      url: string;
    };
  }> {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const kind = detectImageKind(file.buffer);
    if (!kind) {
      throw new BadRequestException('Only JPEG and PNG images are allowed');
    }
    const key = `admin-images/${Date.now()}-${randomUUID()}.${kind.extension}`;

    const uploaded = await this.s3Service.uploadFile(file.buffer, {
      bucket: this.awsConfig.s3ImageBucket,
      key,
      contentType: kind.contentType,
    });

    const signed = await this.s3Service.getPresignedUrl(
      uploaded.key,
      uploaded.bucket,
      { expiresIn: 3600 },
    );

    return {
      message: 'File uploaded successfully',
      data: {
        key: uploaded.key,
        bucket: uploaded.bucket,
        region: uploaded.region,
        contentType: uploaded.contentType,
        size: uploaded.size,
        lastModified: uploaded.uploadedAt,
        url: signed.url,
      },
    };
  }

  @Post('signed-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh a private S3 GET URL (Admin only)' })
  async signedUrl(@Body() dto: SignedUrlDto): Promise<{
    message: string;
    data: { url: string };
  }> {
    const key = assertSafeImageKey(dto.key);
    const bucket = assertAllowedBucket(
      dto.bucket,
      this.awsConfig.allowedImageBuckets,
    );
    const signed = await this.s3Service.getPresignedUrl(key, bucket, {
      expiresIn: 3600,
    });

    return {
      message: 'Signed URL generated successfully',
      data: { url: signed.url },
    };
  }
}

function detectImageKind(
  buffer: Buffer,
): { extension: 'jpg' | 'png'; contentType: string } | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { extension: 'jpg', contentType: 'image/jpeg' };
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { extension: 'png', contentType: 'image/png' };
  }
  return null;
}
