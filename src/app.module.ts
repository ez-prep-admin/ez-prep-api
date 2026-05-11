import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { WinstonModule } from 'nest-winston';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { MockTestsModule } from './mock-tests/mock-tests.module';
import { MockTestAttemptsModule } from './mock-test-attempts/mock-test-attempts.module';
import { CategoriesModule } from './categories/categories.module';
import { ExamsModule } from './exams/exams.module';
import { ExamGroupsModule } from './exam-groups/exam-groups.module';
import { TopicsModule } from './topics/topics.module';
import { SubjectsModule } from './subjects/subjects.module';
import { TagsModule } from './tags/tags.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SearchModule } from './search/search.module';
import { ValidationModule } from './common/validators/validation.module';
import { securityConfig } from './common/config/security.config';
import { winstonConfig } from './common/config/winston.config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';

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
    MockTestAttemptsModule,
    CategoriesModule,
    ExamsModule,
    ExamGroupsModule,
    TopicsModule,
    SubjectsModule,
    TagsModule,
    AnalyticsModule,
    SearchModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    // Global logging interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    // Global timeout interceptor (30 seconds)
    {
      provide: APP_INTERCEPTOR,
      useValue: new TimeoutInterceptor(30000),
    },
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
