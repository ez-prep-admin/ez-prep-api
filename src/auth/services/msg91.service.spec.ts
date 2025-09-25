import { Test, TestingModule } from '@nestjs/testing';
import { Msg91Service } from './msg91.service';
import { ConfigService } from '@nestjs/config';

// Mock global fetch
global.fetch = jest.fn();

describe('Msg91Service', () => {
  let service: Msg91Service;

  beforeAll(() => {
    // Suppress console output during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Service with valid config', () => {
    beforeEach(async () => {
      const mockConfigService = {
        get: jest.fn().mockImplementation((key: string) => {
          if (key === 'MSG91_AUTH_KEY') return 'test-auth-key';
          return null;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          Msg91Service,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      // Disable logging for tests
      await module.init();
      service = module.get<Msg91Service>(Msg91Service);

      // Mock fetch for each test
      global.fetch = jest.fn();
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
      expect(service.verifyAccessToken).toBeDefined();
    });
  });
});
