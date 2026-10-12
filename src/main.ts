import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { useContainer } from 'class-validator';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { CommerceConfigService } from './commerce/commerce-config.service';
import { securityConfig, getCorsConfig } from './common/config/security.config';
import { ObserveInstrument } from './common/observability/observe.config';
import { observeEnabled } from './common/observability/observe.policy';

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
    // NestJs Observability for monitoring and logging
    const app = await NestFactory.create(AppModule, {
      rawBody: true,
      ...(observeEnabled() ? { instrument: ObserveInstrument } : {}),
    });
    const configService = app.get(ConfigService);
    const trustProxyHops = app.get(CommerceConfigService).settings
      .trustProxyHops;
    app.getHttpAdapter().getInstance().set('trust proxy', trustProxyHops);

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

    // Enhanced CORS configuration (per-instance via CORS_ORIGINS)
    app.enableCors(getCorsConfig(configService.get<string>('CORS_ORIGINS')));

    // Global prefix for API routes
    app.setGlobalPrefix('api/v1');

    // Swagger API documentation
    const instanceName =
      configService.get<string>('INSTANCE_NAME')?.trim() ||
      configService.get<string>('INSTANCE_ID')?.trim() ||
      'API';
    const config = new DocumentBuilder()
      .setTitle(`${instanceName} API`)
      .setDescription(
        `${instanceName} API. Topic-wise papers: /mock-tests. Full-exam papers: /full-mock-tests (admin draft → publish). Sprint papers: /sprint-tests (newest exam-tagged questions, admin draft → publish, one timer). Students take all three via /mock-test-attempts. Session-wise full exams: one subject timer at a time; filter questions by sessionOrder / sessions[].questionIds; POST .../sessions/complete before the next subject. GET .../resume unpauses a paused attempt.`,
      )
      .setVersion('1.0.0')
      .addTag('health', 'Health check endpoints')
      .addTag('users', 'User management endpoints')
      .addTag('auth', 'Authentication endpoints')
      .addTag(
        'mock-tests',
        'Topic-wise papers only (paperType TOPIC_WISE). Sprint and full-exam papers are never returned here — use /sprint-tests and /full-mock-tests. Start an attempt with POST /mock-test-attempts/start.',
      )
      .addTag(
        'full-mock-tests',
        'Exam-blueprint papers (paperType FULL_EXAM). Admin: generate draft, replace questions, publish. Student: list/get published papers, then take them via mock-test-attempts (same start/answer/submit as topic-wise; session-wise adds sessions/complete).',
      )
      .addTag(
        'sprint-tests',
        'Sprint papers (paperType SPRINT). Admin drafts the newest exam-tagged questions (10–30), replaces with the same guards as full mocks, then publishes a single-timer paper. Students list/get published papers and take them via mock-test-attempts submit (no sessions).',
      )
      .addTag(
        'mock-test-attempts',
        'Student take-test APIs for topic-wise, sprint, and full-exam papers. Sprint papers use one timer and POST .../submit, the same as topic-wise. Branch on mockTestData.isSessionWise. Session-wise full exams only: show one subject at a time using sessionOrder / sessions[].questionIds; complete a session before the next. GET .../resume unpauses if PAUSED.',
      )
      .addTag('imports', 'Question paper import endpoints')
      .addTag(
        'current-affairs',
        'Daily current affairs: one document per item, grouped by calendar date (YYYY-MM-DD). Admin CRUD; public GET for the user app.',
      )
      .addTag(
        'instance-config',
        'Singleton display settings for this deployment (name, logo, favicon). Admin only. Read returns null until the document is created.',
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
      customSiteTitle: `${instanceName} API Documentation`,
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
  } catch (error) {
    logger.error('❌ Error starting application:', error);
    process.exit(1);
  }
}

// Bootstrap the application 🚀
bootstrap();
