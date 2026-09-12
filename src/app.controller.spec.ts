import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let configValues: Record<string, string | undefined>;

  beforeEach(async () => {
    configValues = {
      NODE_ENV: 'test',
      INSTANCE_NAME: 'EZ Prep',
      INSTANCE_ID: 'ezprep',
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => configValues[key],
          },
        },
      ],
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
      const result = appController.getHealth();
      expect(result.status).toBe('OK');
      expect(result.message).toBe('EZ Prep API is running successfully');
      expect(result.timestamp).toBeDefined();
      expect(result.environment).toBe('test');
    });

    it('should use INSTANCE_NAME in the health message', () => {
      configValues.INSTANCE_NAME = 'ExamFlex';
      const result = appController.getHealth();
      expect(result.message).toBe('ExamFlex API is running successfully');
    });

    it('should fall back to INSTANCE_ID when INSTANCE_NAME is unset', () => {
      configValues.INSTANCE_NAME = undefined;
      configValues.INSTANCE_ID = 'examflex';
      const result = appController.getHealth();
      expect(result.message).toBe('examflex API is running successfully');
    });

    it('should default environment to development when NODE_ENV is unset', () => {
      configValues.NODE_ENV = undefined;
      const result = appController.getHealth();
      expect(result.environment).toBe('development');
    });
  });
});
