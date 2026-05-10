import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Welcome message',
    description: 'Returns a welcome message for the API',
  })
  @ApiResponse({
    status: 200,
    description: 'Welcome message retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Success' },
        data: {
          type: 'object',
          properties: {
            greeting: { type: 'string', example: 'Welcome to EZ Prep API!' },
          },
        },
      },
    },
  })
  getHello(): { message: string; data: { greeting: string } } {
    return {
      message: 'Success',
      data: {
        greeting: this.appService.getHello(),
      },
    };
  }

  @Get('health')
  @ApiOperation({
    summary: 'Health check',
    description: 'Returns the current health status of the API',
  })
  @ApiResponse({
    status: 200,
    description: 'API is healthy and running',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'OK' },
        message: {
          type: 'string',
          example: 'EZ Prep API is running successfully',
        },
        timestamp: { type: 'string', example: '2025-09-17T02:30:00.000Z' },
        environment: { type: 'string', example: 'development' },
      },
    },
  })
  getHealth() {
    return {
      status: 'OK',
      message: 'EZ Prep API is running successfully',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
