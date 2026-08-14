import mongoose from 'mongoose';

expect.extend({
  toBeValidObjectId(received) {
    const pass = mongoose.Types.ObjectId.isValid(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid ObjectId`,
        pass: true,
      };
    }
    return {
      message: () => `expected ${received} to be a valid ObjectId`,
      pass: false,
    };
  },
});

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
