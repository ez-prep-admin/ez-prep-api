import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod: MongoMemoryServer;

// Global test setup
beforeAll(async () => {
  // Start in-memory MongoDB instance for tests
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  // Connect mongoose to the in-memory database
  await mongoose.connect(uri);
});

// Cleanup after all tests
afterAll(async () => {
  // Close mongoose connection
  await mongoose.connection.close();

  // Stop the in-memory database
  if (mongod) {
    await mongod.stop();
  }
});

// Clear all test data after each test
afterEach(async () => {
  const collections = mongoose.connection.collections;

  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

// Extend Jest matchers if needed
expect.extend({
  toBeValidObjectId(received) {
    const pass = mongoose.Types.ObjectId.isValid(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid ObjectId`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid ObjectId`,
        pass: false,
      };
    }
  },
});

// Global test utilities
global.testUtils = {
  createMockUser: () => ({
    _id: new mongoose.Types.ObjectId(),
    name: 'Test User',
    email: 'test@example.com',
    phone: '+1234567890',
    role: 'student',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),

  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  generateValidPhoneNumber: () =>
    `+${Math.floor(Math.random() * 9000000000) + 1000000000}`,

  generateValidEmail: () => `test${Date.now()}@example.com`,
};

// Mock external services by default
jest.mock('../src/auth/services/msg91.service');

// Set up console.log capture for testing
const originalConsole = console;
beforeEach(() => {
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
});

afterEach(() => {
  global.console = originalConsole;
});
