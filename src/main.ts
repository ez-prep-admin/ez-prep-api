import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { useContainer } from 'class-validator';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { securityConfig } from './common/config/security.config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('❌ Uncaught Exception:', error.stack);
    // Give time for logs to flush
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // Handle unhandled promise rejections
  process.on(
    'unhandledRejection',
    (reason: unknown, _promise: Promise<unknown>) => {
      const errorMessage =
        reason instanceof Error ? reason.stack : String(reason);
      logger.error('❌ Unhandled Promise Rejection:', errorMessage);
      // Don't exit immediately - log and continue
    },
  );

  // Handle SIGTERM gracefully
  process.on('SIGTERM', () => {
    logger.log('⚠️ SIGTERM signal received: closing HTTP server');
    process.exit(0);
  });

  // Handle SIGINT gracefully (Ctrl+C)
  process.on('SIGINT', () => {
    logger.log('⚠️ SIGINT signal received: closing HTTP server');
    process.exit(0);
  });

  try {
    const app = await NestFactory.create(AppModule);
    const configService = app.get(ConfigService);

    // Enable class-validator to use NestJS dependency injection
    useContainer(app.select(AppModule), { fallbackOnErrors: true });

    // Security headers with Helmet
    app.use(helmet(securityConfig.helmet));

    // Global validation pipe with transformation and improved error messages
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
        exceptionFactory: errors => {
          const formattedErrors = errors.map(error => ({
            field: error.property,
            value: error.value,
            constraints: error.constraints
              ? Object.values(error.constraints)
              : [],
          }));

          return new BadRequestException({
            statusCode: 400,
            error: 'ValidationError',
            message: 'Validation failed for the provided input',
            details: formattedErrors,
          });
        },
      }),
    );

    // Enhanced CORS configuration
    app.enableCors(securityConfig.cors);

    // Global prefix for API routes
    app.setGlobalPrefix('api/v1');

    // Swagger API documentation
    const config = new DocumentBuilder()
      .setTitle('EZ Prep API')
      .setDescription(
        'EZ Prep API for topic-wise mock tests, exam-blueprint full mock tests, attempts, and related catalog (exams, subjects, topics). Full mocks are generated from an exam blueprint, reviewed as a draft, then published into the same mocktests collection as paperType FULL_EXAM. Topic-wise lists never include full-exam papers.',
      )
      .setVersion('1.0.0')
      .addTag('health', 'Health check endpoints')
      .addTag('users', 'User management endpoints')
      .addTag('auth', 'Authentication endpoints')
      .addTag(
        'mock-tests',
        'Topic-wise mock tests (paperType TOPIC_WISE). Does not return full-exam papers.',
      )
      .addTag(
        'full-mock-tests',
        'Exam-blueprint full mock tests: admin generate/review/publish, student list by exam.',
      )
      .addTag(
        'mock-test-attempts',
        'Start, answer, pause/resume, submit attempts. Also session-wise complete for full exams.',
      )
      .addTag('imports', 'Question paper import endpoints')
      .addTag(
        'current-affairs',
        'Daily current affairs: one document per item, grouped by calendar date (YYYY-MM-DD). Admin CRUD; public GET for the user app.',
      )
      .addTag('tests', 'Test management endpoints (coming soon)')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addServer('http://localhost:3000', 'Development server')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
      customSiteTitle: 'EZ Prep API Documentation',
      customfavIcon: 'https://swagger.io/favicon.ico',
    });

    const port = configService.get<number>('PORT') || 3000;
    await app.listen(port);

    logger.log(`🚀 Application is running on: http://localhost:${port}`);
    logger.log(`📚 API Documentation: http://localhost:${port}/api/v1`);
    logger.log(`📖 Swagger Documentation: http://localhost:${port}/api/docs`);
    logger.log(`🛡️ Security headers enabled with Helmet`);
    logger.log(
      `⚡ Rate limiting: ${securityConfig.rateLimit.limit} requests per ${securityConfig.rateLimit.ttl}ms`,
    );
    logger.log(`✅ Advanced validation with custom validators enabled`);
    logger.log(`📝 Winston logging configured - logs saved to ./logs/`);
  } catch (error) {
    logger.error('❌ Error starting application:', error);
    process.exit(1);
  }
}

// Bootstrap the application 🚀
bootstrap();
