import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toEqual({
        message: 'Success',
        data: { greeting: 'Hello World!' },
      });
    });
  });

  describe('health', () => {
    it('should return OK status and environment', () => {
      const previousEnv = process.env.NODE_ENV;
      const previousName = process.env.INSTANCE_NAME;
      process.env.NODE_ENV = 'test';
      process.env.INSTANCE_NAME = 'EZ Prep';
      const result = appController.getHealth();
      expect(result.status).toBe('OK');
      expect(result.message).toBe('EZ Prep API is running successfully');
      expect(result.timestamp).toBeDefined();
      expect(result.environment).toBe('test');
      process.env.NODE_ENV = previousEnv;
      if (previousName === undefined) {
        delete process.env.INSTANCE_NAME;
      } else {
        process.env.INSTANCE_NAME = previousName;
      }
    });

    it('should use INSTANCE_NAME in the health message', () => {
      const previousName = process.env.INSTANCE_NAME;
      process.env.INSTANCE_NAME = 'ExamFlex';
      const result = appController.getHealth();
      expect(result.message).toBe('ExamFlex API is running successfully');
      if (previousName === undefined) {
        delete process.env.INSTANCE_NAME;
      } else {
        process.env.INSTANCE_NAME = previousName;
      }
    });

    it('should default environment to development when NODE_ENV is unset', () => {
      const previous = process.env.NODE_ENV;
      delete process.env.NODE_ENV;
      const result = appController.getHealth();
      expect(result.environment).toBe('development');
      process.env.NODE_ENV = previous;
    });
  });
});
