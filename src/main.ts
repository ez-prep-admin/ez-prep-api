import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { useContainer } from 'class-validator';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { securityConfig } from './common/config/security.config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create(AppModule);
    const configService = app.get(ConfigService);

    // Enable class-validator to use NestJS dependency injection
    useContainer(app.select(AppModule), { fallbackOnErrors: true });

    // Security headers with Helmet
    app.use(helmet(securityConfig.helmet));

    // Global exception filter for standardized error responses
    app.useGlobalFilters(new HttpExceptionFilter());

    // Global validation pipe with transformation
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
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
        'A comprehensive mock test application API with user management, authentication, and test functionality',
      )
      .setVersion('1.0.0')
      .addTag('health', 'Health check endpoints')
      .addTag('users', 'User management endpoints')
      .addTag('auth', 'Authentication endpoints (coming soon)')
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

bootstrap();
