import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MathpixService } from './mathpix.service';

/**
 * Mathpix Integration Module
 * Provides PDF to Markdown conversion services
 * 
 * SETUP REQUIRED:
 * Add to your .env file:
 *   MATHPIX_APP_ID=your_app_id_here
 *   MATHPIX_APP_KEY=your_app_key_here
 * 
 * Get credentials from: https://mathpix.com/
 */
@Module({
  imports: [ConfigModule],
  providers: [MathpixService],
  exports: [MathpixService],
})
export class MathpixModule {}
