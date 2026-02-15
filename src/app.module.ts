import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { WinstonModule } from 'nest-winston';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { MockTestsModule } from './mock-tests/mock-tests.module';
import { ValidationModule } from './common/validators/validation.module';
import { securityConfig } from './common/config/security.config';
import { winstonConfig } from './common/config/winston.config';

@Module({
  imports: [
    // Global configuration module
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // MongoDB connection with async configuration
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const mongoUri = configService.get<string>('MONGODB_URI');
        console.log(
          '🔍 MongoDB URI from config:',
          mongoUri ? 'Found' : 'NOT FOUND',
        );

        if (!mongoUri) {
          console.error(
            '❌ MONGODB_URI is not defined in environment variables',
          );
          console.log(
            '📋 Available environment variables:',
            Object.keys(process.env).filter(key => key.startsWith('MONGODB')),
          );
          throw new Error('MONGODB_URI environment variable is required');
        }

        return {
          uri: mongoUri,
          connectionFactory: connection => {
            connection.on('connected', () => {
              console.log('✅ MongoDB connected successfully');
            });
            connection.on('error', error => {
              console.error('❌ MongoDB connection error:', error);
            });
            connection.on('disconnected', () => {
              console.log('🔌 MongoDB disconnected');
            });
            return connection;
          },
        };
      },
      inject: [ConfigService],
    }),
    // Rate limiting configuration
    ThrottlerModule.forRoot([securityConfig.rateLimit]),
    // Winston logging configuration
    WinstonModule.forRoot(winstonConfig),
    // Custom validation module
    ValidationModule,
    UsersModule,
    AuthModule,
    MockTestsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
