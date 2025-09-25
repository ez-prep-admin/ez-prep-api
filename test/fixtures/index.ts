import { TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../src/users/schemas/user.schema';

// Mock User Model
export class MockUserModel {
  constructor(private data: any) {}

  save = jest.fn().mockResolvedValue(this.data);
  static find = jest.fn();
  static findOne = jest.fn();
  static findById = jest.fn();
  static findOneAndUpdate = jest.fn();
  static findByIdAndUpdate = jest.fn();
  static findByIdAndDelete = jest.fn();
  static create = jest.fn();
  static countDocuments = jest.fn();
  static aggregate = jest.fn();
  static populate = jest.fn();
}

// Mock JWT Service
export const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest
    .fn()
    .mockReturnValue({ userId: 'mock-user-id', phone: '+1234567890' }),
  decode: jest.fn(),
};

// Mock MSG91 Service
export const mockMsg91Service = {
  sendOtp: jest.fn().mockResolvedValue({
    success: true,
    message: 'OTP sent successfully',
  }),
  verifyOtp: jest.fn().mockResolvedValue({
    success: true,
    message: '+1234567890',
  }),
  verifyAccessToken: jest.fn().mockResolvedValue('+1234567890'),
};

// Mock Logger Service
export const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
};

// Mock Throttler Guard
export const mockThrottlerGuard = {
  canActivate: jest.fn().mockReturnValue(true),
};

// Mock JWT Auth Guard
export const mockJwtAuthGuard = {
  canActivate: jest.fn().mockReturnValue(true),
};

// Mock Roles Guard
export const mockRolesGuard = {
  canActivate: jest.fn().mockReturnValue(true),
};

// Test User Fixtures
export const mockUsers = {
  validStudent: {
    _id: '507f1f77bcf86cd799439011',
    id: '507f1f77bcf86cd799439011',
    name: 'John Doe',
    email: 'john@example.com',
    phoneNumber: '+1234567890',
    role: 'student',
    isActive: true,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  },

  validInstructor: {
    _id: '507f1f77bcf86cd799439012',
    id: '507f1f77bcf86cd799439012',
    name: 'Jane Smith',
    email: 'jane@example.com',
    phoneNumber: '+1234567891',
    role: 'instructor',
    isActive: true,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  },

  validAdmin: {
    _id: '507f1f77bcf86cd799439013',
    id: '507f1f77bcf86cd799439013',
    name: 'Admin User',
    email: 'admin@example.com',
    phoneNumber: '+1234567892',
    role: 'admin',
    isActive: true,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  },

  inactiveUser: {
    _id: '507f1f77bcf86cd799439014',
    id: '507f1f77bcf86cd799439014',
    name: 'Inactive User',
    email: 'inactive@example.com',
    phoneNumber: '+1234567893',
    role: 'student',
    isActive: false,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  },
};

// Mock Request Objects
export const mockAuthRequest = {
  user: mockUsers.validStudent,
  headers: {
    authorization: 'Bearer mock-jwt-token',
  },
};

export const mockResponse = {
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
  cookie: jest.fn().mockReturnThis(),
  clearCookie: jest.fn().mockReturnThis(),
};

// Mock DTO Data
export const mockDtos = {
  validVerifyOtp: {
    sessionId: 'mock-session-id',
    otp: '123456',
    name: 'John Doe',
    email: 'john@example.com',
  },

  validCreateUser: {
    name: 'Test User',
    email: 'test@example.com',
    phoneNumber: '+1234567890',
    role: 'student',
  },

  validUpdateUser: {
    name: 'Updated User',
    email: 'updated@example.com',
  },
};

// Helper function to create testing module with common mocks
export const createTestingModule = async (
  providers: any[] = [],
): Promise<TestingModule> => {
  const { Test } = await import('@nestjs/testing');

  const module = Test.createTestingModule({
    providers: [
      {
        provide: getModelToken(User.name),
        useValue: MockUserModel,
      },
      ...providers,
    ],
  });

  return module.compile();
};

// Database test utilities
export const dbTestUtils = {
  clearCollection: async (model: Model<any>) => {
    await model.deleteMany({});
  },

  createUser: async (model: Model<User>, userData: Partial<User>) => {
    const user = new model({
      name: 'Test User',
      email: 'test@example.com',
      phone: '+1234567890',
      role: 'student',
      ...userData,
    });
    return user.save();
  },

  findUserByPhone: async (model: Model<User>, phone: string) => {
    return model.findOne({ phone, isActive: true });
  },
};

// API Response Mocks
export const mockApiResponses = {
  authSuccess: {
    success: true,
    user: mockUsers.validStudent,
    token: 'mock-jwt-token',
  },

  authError: {
    success: false,
    message: 'Authentication failed',
  },

  userCreated: {
    success: true,
    message: 'User created successfully',
    user: mockUsers.validStudent,
  },

  userUpdated: {
    success: true,
    message: 'User updated successfully',
    user: mockUsers.validStudent,
  },

  userNotFound: {
    success: false,
    message: 'User not found',
  },
};

// Mock environment variables
export const mockEnvVars = {
  JWT_SECRET: 'test-jwt-secret',
  JWT_EXPIRES_IN: '7d',
  MSG91_API_KEY: 'test-api-key',
  MSG91_TEMPLATE_ID: 'test-template-id',
  MSG91_AUTH_KEY: 'test-auth-key',
  MONGODB_URI: 'mongodb://localhost:27017/ezprep-test',
};
