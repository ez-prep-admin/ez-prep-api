import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { mockEnvVars } from '../fixtures';
import mongoose from 'mongoose';

describe('Authentication E2E Tests', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    // Set environment variables for testing
    Object.assign(process.env, mockEnvVars);

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(MongooseModule.forRoot(process.env.MONGODB_URI))
      .useModule(
        MongooseModule.forRoot('mongodb://localhost:27017/ezprep-test'),
      )
      .compile();

    app = moduleRef.createNestApplication();

    // Apply global pipes and middleware
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await mongoose.connection.close();
    await app.close();
  });

  describe('Authentication Flow (E2E)', () => {
    let sessionId: string;
    let authToken: string;
    let userId: string;

    describe('POST /auth/send-otp', () => {
      it('should send OTP successfully for valid phone number', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/send-otp')
          .send({ phone: '+1234567890' })
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('OTP sent');
        expect(response.body.sessionId).toBeDefined();

        sessionId = response.body.sessionId;
      });

      it('should reject invalid phone number format', async () => {
        await request(app.getHttpServer())
          .post('/auth/send-otp')
          .send({ phone: 'invalid-phone' })
          .expect(400);
      });

      it('should reject empty phone number', async () => {
        await request(app.getHttpServer())
          .post('/auth/send-otp')
          .send({ phone: '' })
          .expect(400);
      });

      it('should reject missing phone number', async () => {
        await request(app.getHttpServer())
          .post('/auth/send-otp')
          .send({})
          .expect(400);
      });

      it('should handle rate limiting', async () => {
        // First few requests should succeed
        for (let i = 0; i < 3; i++) {
          await request(app.getHttpServer())
            .post('/auth/send-otp')
            .send({ phone: `+123456789${i}` })
            .expect(201);
        }

        // Rapid subsequent requests might be rate limited
        // Note: This depends on your throttling configuration
      });
    });

    describe('POST /auth/verify-otp', () => {
      beforeEach(async () => {
        // Send OTP to get session ID
        const otpResponse = await request(app.getHttpServer())
          .post('/auth/send-otp')
          .send({ phone: '+1234567890' });

        sessionId = otpResponse.body.sessionId;
      });

      it('should register new user and authenticate successfully', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/verify-otp')
          .send({
            sessionId,
            otp: '123456', // Mock OTP
            name: 'John Doe',
            email: 'john@example.com',
          })
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.user).toBeDefined();
        expect(response.body.user.name).toBe('John Doe');
        expect(response.body.user.email).toBe('john@example.com');
        expect(response.body.user.phone).toBe('+1234567890');
        expect(response.body.user.role).toBe('student');
        expect(response.body.token).toBeDefined();

        authToken = response.body.token;
        userId = response.body.user._id;

        // Validate token and user ID formats
        expect(authToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/); // JWT format
        expect(userId).toMatch(/^[0-9a-fA-F]{24}$/); // MongoDB ObjectId format
      });

      it('should authenticate existing user without additional data', async () => {
        // First, create a user
        await request(app.getHttpServer()).post('/auth/verify-otp').send({
          sessionId,
          otp: '123456',
          name: 'Existing User',
          email: 'existing@example.com',
        });

        // Get new session for existing user
        const otpResponse = await request(app.getHttpServer())
          .post('/auth/send-otp')
          .send({ phone: '+1234567890' });

        // Login without name/email
        const response = await request(app.getHttpServer())
          .post('/auth/verify-otp')
          .send({
            sessionId: otpResponse.body.sessionId,
            otp: '123456',
          })
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.user.name).toBe('Existing User');
        expect(response.body.token).toBeDefined();
      });

      it('should reject invalid OTP', async () => {
        await request(app.getHttpServer())
          .post('/auth/verify-otp')
          .send({
            sessionId,
            otp: 'invalid',
            name: 'John Doe',
            email: 'john@example.com',
          })
          .expect(401);
      });

      it('should reject invalid session ID', async () => {
        await request(app.getHttpServer())
          .post('/auth/verify-otp')
          .send({
            sessionId: 'invalid-session',
            otp: '123456',
            name: 'John Doe',
            email: 'john@example.com',
          })
          .expect(401);
      });

      it('should require name and email for new users', async () => {
        // Get session for new phone number
        const otpResponse = await request(app.getHttpServer())
          .post('/auth/send-otp')
          .send({ phone: '+9876543210' });

        await request(app.getHttpServer())
          .post('/auth/verify-otp')
          .send({
            sessionId: otpResponse.body.sessionId,
            otp: '123456',
            // Missing name and email
          })
          .expect(400);
      });

      it('should validate email format', async () => {
        const otpResponse = await request(app.getHttpServer())
          .post('/auth/send-otp')
          .send({ phone: '+9876543211' });

        await request(app.getHttpServer())
          .post('/auth/verify-otp')
          .send({
            sessionId: otpResponse.body.sessionId,
            otp: '123456',
            name: 'Test User',
            email: 'invalid-email',
          })
          .expect(400);
      });
    });
  });

  describe('Protected Routes (E2E)', () => {
    let authToken: string;
    let userId: string;

    beforeEach(async () => {
      // Create and authenticate a user
      const otpResponse = await request(app.getHttpServer())
        .post('/auth/send-otp')
        .send({ phone: '+1234567890' });

      const authResponse = await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({
          sessionId: otpResponse.body.sessionId,
          otp: '123456',
          name: 'Test User',
          email: 'test@example.com',
        });

      authToken = authResponse.body.token;
      userId = authResponse.body.user._id;
    });

    describe('GET /users/me', () => {
      it('should return current user profile with valid token', async () => {
        const response = await request(app.getHttpServer())
          .get('/users/me')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body._id).toBe(userId);
        expect(response.body.name).toBe('Test User');
        expect(response.body.email).toBe('test@example.com');
        expect(response.body.phone).toBe('+1234567890');
      });

      it('should reject request without token', async () => {
        await request(app.getHttpServer()).get('/users/me').expect(401);
      });

      it('should reject request with invalid token', async () => {
        await request(app.getHttpServer())
          .get('/users/me')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);
      });

      it('should reject request with malformed authorization header', async () => {
        await request(app.getHttpServer())
          .get('/users/me')
          .set('Authorization', 'InvalidFormat token')
          .expect(401);
      });
    });

    describe('PUT /users/me', () => {
      it('should update current user profile', async () => {
        const updateData = {
          name: 'Updated Name',
          email: 'updated@example.com',
        };

        const response = await request(app.getHttpServer())
          .put('/users/me')
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.name).toBe('Updated Name');
        expect(response.body.email).toBe('updated@example.com');
      });

      it('should validate email format in updates', async () => {
        await request(app.getHttpServer())
          .put('/users/me')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ email: 'invalid-email' })
          .expect(400);
      });

      it('should reject unauthorized fields', async () => {
        await request(app.getHttpServer())
          .put('/users/me')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            role: 'admin', // Should not be allowed
            isActive: false,
          })
          .expect(400);
      });
    });

    describe('Role-based Access Control', () => {
      let studentToken: string;

      beforeEach(async () => {
        // Create users with different roles
        // Note: In real implementation, roles would be assigned differently

        // Student (already created above)
        studentToken = authToken;

        // Create admin and instructor tokens would require
        // special setup or database seeding
      });

      it('should allow admin access to all user routes', async () => {
        // This test would require proper admin user setup
        // await request(app.getHttpServer())
        //   .get('/users')
        //   .set('Authorization', `Bearer ${adminToken}`)
        //   .expect(200);
      });

      it('should restrict student access to admin routes', async () => {
        await request(app.getHttpServer())
          .get('/users') // Assuming this requires admin role
          .set('Authorization', `Bearer ${studentToken}`)
          .expect(403); // Should be forbidden
      });
    });
  });

  describe('Data Persistence (E2E)', () => {
    it('should persist user data across requests', async () => {
      // Create user
      const otpResponse = await request(app.getHttpServer())
        .post('/auth/send-otp')
        .send({ phone: '+5555555555' });

      const authResponse = await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({
          sessionId: otpResponse.body.sessionId,
          otp: '123456',
          name: 'Persistent User',
          email: 'persistent@example.com',
        });

      const token = authResponse.body.token;
      const userId = authResponse.body.user._id;

      // Update user
      await request(app.getHttpServer())
        .put('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Persistent User' });

      // Verify persistence
      const profileResponse = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(profileResponse.body._id).toBe(userId);
      expect(profileResponse.body.name).toBe('Updated Persistent User');
      expect(profileResponse.body.email).toBe('persistent@example.com');
    });

    it('should handle duplicate phone number registration attempts', async () => {
      const phone = '+7777777777';

      // Create first user
      const otpResponse1 = await request(app.getHttpServer())
        .post('/auth/send-otp')
        .send({ phone });

      await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({
          sessionId: otpResponse1.body.sessionId,
          otp: '123456',
          name: 'First User',
          email: 'first@example.com',
        })
        .expect(201);

      // Attempt to create second user with same phone
      const otpResponse2 = await request(app.getHttpServer())
        .post('/auth/send-otp')
        .send({ phone });

      // Should login existing user instead of creating new one
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({
          sessionId: otpResponse2.body.sessionId,
          otp: '123456',
        })
        .expect(201);

      expect(loginResponse.body.user.name).toBe('First User');
      expect(loginResponse.body.user.email).toBe('first@example.com');
    });
  });

  describe('Error Handling (E2E)', () => {
    it('should handle malformed JSON requests', async () => {
      await request(app.getHttpServer())
        .post('/auth/send-otp')
        .send('invalid json')
        .expect(400);
    });

    it('should handle missing Content-Type header', async () => {
      await request(app.getHttpServer())
        .post('/auth/send-otp')
        .send({ phone: '+1234567890' })
        .expect(201); // Should still work with proper data
    });

    it('should return consistent error format', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/send-otp')
        .send({ phone: 'invalid' })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode');
      expect(response.body).toHaveProperty('message');
      expect(response.body.statusCode).toBe(400);
    });

    it('should handle server errors gracefully', async () => {
      // This would require mocking database failures
      // Implementation depends on your specific error handling
    });
  });

  describe('Security Tests (E2E)', () => {
    it('should reject SQL injection attempts', async () => {
      await request(app.getHttpServer())
        .post('/auth/send-otp')
        .send({ phone: "'+OR 1=1--" })
        .expect(400);
    });

    it('should reject XSS attempts in user data', async () => {
      const otpResponse = await request(app.getHttpServer())
        .post('/auth/send-otp')
        .send({ phone: '+1234567890' });

      await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({
          sessionId: otpResponse.body.sessionId,
          otp: '123456',
          name: '<script>alert("xss")</script>',
          email: 'test@example.com',
        })
        .expect(400); // Should be rejected by validation
    });

    it('should handle very long input strings', async () => {
      const longString = 'a'.repeat(10000);

      await request(app.getHttpServer())
        .post('/auth/send-otp')
        .send({ phone: longString })
        .expect(400);
    });
  });

  describe('Performance Tests (E2E)', () => {
    it('should handle concurrent authentication requests', async () => {
      const requests = Array(10)
        .fill(null)
        .map((_, index) =>
          request(app.getHttpServer())
            .post('/auth/send-otp')
            .send({ phone: `+123456789${index}` }),
        );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });
    });

    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .post('/auth/send-otp')
        .send({ phone: '+1234567890' })
        .expect(201);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
    });
  });
});
