# Error Handling System

## Overview

The EZ Prep API implements a comprehensive, production-ready error handling system that ensures graceful error recovery, clear error messages for clients, and security best practices.

## Architecture

### 1. Global Exception Filter (`HttpExceptionFilter`)

**Location:** `src/common/filters/http-exception.filter.ts`

**Features:**
- Catches all exceptions across the entire application
- Provides standardized error response format
- Handles multiple error types with specific responses
- Production-safe (doesn't leak sensitive info in production)
- Comprehensive logging with appropriate log levels

**Error Types Handled:**
- HTTP exceptions (standard NestJS errors)
- Rate limiting errors (Throttler)
- MongoDB errors (duplicate keys, connection issues, validation)
- Mongoose errors (validation, casting, ObjectId)
- JWT errors (invalid, expired, not active)
- Unexpected errors (with safe fallback)

**Response Format:**
```json
{
  "statusCode": 400,
  "error": "ValidationError",
  "message": "Validation failed for the provided input",
  "timestamp": "2026-05-10T12:00:00.000Z",
  "path": "/api/v1/users",
  "method": "POST",
  "details": [...]  // Optional, only for client errors or non-production
}
```

### 2. Process-Level Error Handlers

**Location:** `src/main.ts`

**Handlers:**
- `uncaughtException` - Catches unhandled exceptions and gracefully shuts down
- `unhandledRejection` - Logs unhandled promise rejections
- `SIGTERM` - Graceful shutdown on termination signal
- `SIGINT` - Graceful shutdown on Ctrl+C

**Why This Matters:**
Prevents the application from crashing silently and ensures all errors are logged before shutdown.

### 3. Logging Interceptor

**Location:** `src/common/interceptors/logging.interceptor.ts`

**Features:**
- Logs all HTTP requests and responses
- Includes timing information
- Captures IP address and user agent
- Non-intrusive (doesn't affect error handling)

**Log Format:**
```
[HTTP] GET /api/v1/exams/by-category 200 1024b - 45ms - ::1 - Mozilla/5.0...
```

### 4. Timeout Interceptor

**Location:** `src/common/interceptors/timeout.interceptor.ts`

**Features:**
- Prevents long-running requests from hanging
- Default timeout: 30 seconds
- Returns clear error message on timeout
- Prevents resource exhaustion

### 5. Enhanced Validation

**Location:** Configuration in `src/main.ts`

**Features:**
- Automatic DTO validation
- Strips unknown properties (`whitelist: true`)
- Rejects unknown properties (`forbidNonWhitelisted: true`)
- Clear, structured validation error messages

**Validation Error Format:**
```json
{
  "statusCode": 400,
  "error": "ValidationError",
  "message": "Validation failed for the provided input",
  "details": [
    {
      "field": "email",
      "value": "invalid-email",
      "constraints": [
        "email must be a valid email address"
      ]
    }
  ]
}
```

### 6. Custom Error Classes

**Location:** `src/common/errors/custom-errors.ts`

**Available Error Classes:**
- `DatabaseConnectionError` - Database connectivity issues (503)
- `ResourceNotFoundError` - Resource not found (404)
- `DuplicateResourceError` - Duplicate entries (409)
- `InvalidOperationError` - Invalid business logic operation (400)
- `UnauthorizedAccessError` - Permission denied (403)
- `AuthenticationError` - Authentication failed (401)
- `ValidationError` - Custom validation errors (400)
- `RateLimitError` - Rate limit exceeded (429)
- `ExternalServiceError` - External service unavailable (503)

**Usage Example:**
```typescript
import { ResourceNotFoundError } from './common/errors/custom-errors';

async findOne(id: string) {
  const user = await this.userModel.findById(id);
  if (!user) {
    throw new ResourceNotFoundError('User', id);
  }
  return user;
}
```

## Security Features

### 1. Production Mode Safety
- Stack traces only shown in development
- Generic error messages in production
- Sensitive data never exposed

### 2. MongoDB Error Handling
- Duplicate key errors: Returns user-friendly message without revealing schema
- Connection errors: Returns generic "database error" message
- Validation errors: Sanitized field names only

### 3. JWT Error Handling
- Invalid tokens: Clear error without token details
- Expired tokens: Prompts re-authentication
- Prevents token enumeration attacks

### 4. Request Security
- Rate limiting with clear error messages
- Request timeouts prevent DoS
- Input validation prevents injection attacks

## Error Response Codes

| Code | Error Type | Description |
|------|-----------|-------------|
| 400 | Bad Request | Validation failed or invalid input |
| 401 | Unauthorized | Authentication required or failed |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource (e.g., email exists) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |
| 503 | Service Unavailable | Database or external service down |

## Logging Levels

### Error (500+ status codes)
- Logged with full stack trace
- Requires immediate attention
- Includes request details

### Warning (400-499 except 400, 401)
- Logged without stack trace
- Client-side errors
- Useful for monitoring abuse

### Debug (Validation & Auth errors)
- Not logged to avoid spam
- Expected errors from normal use

## Best Practices

### 1. Use Custom Error Classes
```typescript
// ✅ Good
throw new ResourceNotFoundError('Exam', examId);

// ❌ Avoid
throw new NotFoundException(`Exam ${examId} not found`);
```

### 2. Provide Context in Error Messages
```typescript
// ✅ Good
throw new InvalidOperationError('Cannot start exam attempt: exam is inactive');

// ❌ Avoid
throw new BadRequestException('Invalid');
```

### 3. Handle Async Errors Properly
```typescript
// ✅ Good
async getExam(id: string) {
  try {
    return await this.examModel.findById(id);
  } catch (error) {
    this.logger.error('Failed to fetch exam', error);
    throw new DatabaseConnectionError();
  }
}
```

### 4. Don't Catch and Suppress
```typescript
// ❌ Avoid
try {
  await operation();
} catch (error) {
  // Silent failure - never do this!
}

// ✅ Good
try {
  await operation();
} catch (error) {
  this.logger.error('Operation failed', error);
  throw error; // Re-throw or throw custom error
}
```

## Testing Error Handling

### Test Different Error Scenarios
```typescript
// Invalid input
POST /api/v1/exams
Body: { "name": "" }  // Empty name should return 400

// Duplicate entry
POST /api/v1/categories
Body: { "shortName": "SSC" }  // If exists, returns 409

// Not found
GET /api/v1/exams/invalidObjectId  // Returns 400 (invalid ID)
GET /api/v1/exams/64f123456789abcdef123456  // Returns 404 (not found)

// Rate limiting
// Make 101 requests quickly - should return 429

// Timeout
// Long-running operation > 30s - should return 408
```

## Environment Configuration

Add to `.env`:
```env
NODE_ENV=production  # For production-safe error messages
```

## Monitoring Recommendations

1. **Log Aggregation**: Use tools like ELK stack or CloudWatch
2. **Error Tracking**: Integrate Sentry or similar for production
3. **Alerts**: Set up alerts for 500-level errors
4. **Metrics**: Monitor error rates by endpoint

## Future Improvements

- [ ] Integration with error tracking service (e.g., Sentry)
- [ ] Error rate limiting per endpoint
- [ ] Automatic retry for transient failures
- [ ] Circuit breaker pattern for external services
- [ ] Error analytics dashboard

## Summary

The error handling system provides:
- ✅ Graceful error recovery (no crashes)
- ✅ Clear error messages for frontend
- ✅ Security (no sensitive data leaks)
- ✅ Comprehensive logging
- ✅ Production-ready
- ✅ Easy to extend with custom error types
- ✅ Standardized error format across all endpoints
