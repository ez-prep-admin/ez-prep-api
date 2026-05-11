# GitHub Copilot Instructions for EZ Prep API

This document contains coding standards, best practices, and architectural guidelines for the EZ Prep API project. All contributors and AI assistants must follow these guidelines to maintain code quality and consistency.

## Table of Contents

1. [TypeScript Standards](#typescript-standards)
2. [NestJS Architecture](#nestjs-architecture)
3. [MongoDB & Mongoose](#mongodb--mongoose)
4. [DTOs & Validation](#dtos--validation)
5. [API Response Format](#api-response-format)
6. [Authentication & Authorization](#authentication--authorization)
7. [Error Handling](#error-handling)
8. [Documentation](#documentation)
9. [Testing](#testing)
10. [Code Organization](#code-organization)

---

## TypeScript Standards

### ❌ NEVER Use `any` Type

**FORBIDDEN:**
```typescript
const query: any = {};
const data: any = {};
function process(value: any) { }
```

**CORRECT:**
```typescript
import { FilterQuery } from 'mongoose';

const query: FilterQuery<UserDocument> = {};
const data: UserResponseDto = {};
function process(value: string | number) { }
```

### Type Safety Rules

1. **Always use explicit types** for function parameters and return values
2. **Use generics** for reusable components
3. **Leverage TypeScript utility types**: `Partial<T>`, `Pick<T>`, `Omit<T>`, `Record<K, V>`
4. **Create type aliases** for complex types
5. **Use `unknown` instead of `any`** when type is truly unknown, then narrow with type guards

### Type Casting Rules

**FORBIDDEN:**
```typescript
const user = data as any;
const result = (response as any).data;
```

**CORRECT:**
```typescript
// Use proper interfaces
interface PopulatedDocument {
  _id?: unknown;
  name?: string;
}

const user = data as PopulatedDocument;

// Or use type guards
if (typeof response === 'object' && response !== null && 'data' in response) {
  const result = response.data;
}
```

---

## NestJS Architecture

### Module Structure

Every feature must have its own module with the following structure:

```
feature/
├── dto/
│   ├── create-feature.dto.ts
│   ├── update-feature.dto.ts
│   ├── feature-response.dto.ts
│   └── paginated-feature-response.dto.ts
├── schemas/
│   └── feature.schema.ts
├── feature.controller.ts
├── feature.service.ts
└── feature.module.ts
```

### Dependency Injection

1. **Always use constructor injection**
2. **Inject interfaces/abstract classes** when possible
3. **Use `@Injectable()` decorator** for all services
4. **Declare all dependencies** in module imports

### Controller Best Practices

1. **Keep controllers thin** - delegate business logic to services
2. **Use proper HTTP status codes** with `@HttpCode()` decorator
3. **Use route guards** for authentication and authorization
4. **Document all endpoints** with Swagger decorators

```typescript
@Controller('users')
@ApiTags('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  async create(@Body() createUserDto: CreateUserDto): Promise<{
    message: string;
    data: UserResponseDto;
  }> {
    const user = await this.usersService.create(createUserDto);
    return {
      message: 'User created successfully',
      data: user,
    };
  }
}
```

---

## MongoDB & Mongoose

### Schema Definition

1. **Use TypeScript classes** for schemas
2. **Define document types** explicitly
3. **Add indexes** for frequently queried fields
4. **Implement soft delete** with `isDeleted` flag
5. **Add virtual fields** for ID transformation

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Query } from 'mongoose';

export type UserDocument = User & Document;

@Schema({
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret) => {
      ret.id = ret._id?.toString();
      delete ret._id;
      delete ret.password;
      return ret;
    },
  },
})
export class User {
  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ required: true, index: true })
  name: string;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Virtual field
UserSchema.virtual('id').get(function () {
  return this._id?.toString();
});

// Soft delete middleware
UserSchema.pre(/^find/, function (this: Query<unknown, UserDocument>) {
  this.where({ isDeleted: { $ne: true } });
});
```

### Query Best Practices

1. **Use `FilterQuery<T>` type** for query objects
2. **Use `Types.ObjectId()`** for ObjectId fields
3. **Always use `.lean()`** for read-only queries
4. **Use projection** to limit returned fields
5. **Add pagination** to list endpoints

**FORBIDDEN:**
```typescript
const query: any = { status: 'active' };
const user = await this.userModel.findOne({ _id: userId });
```

**CORRECT:**
```typescript
import { FilterQuery, Types } from 'mongoose';

const query: FilterQuery<UserDocument> = { status: 'active' };
const user = await this.userModel.findOne({ _id: new Types.ObjectId(userId) });
```

### ObjectId Handling

**CRITICAL:** When querying by ObjectId fields, always convert string IDs to ObjectId:

```typescript
// WRONG - String comparison won't match ObjectId in MongoDB
const mockTests = await this.mockTestModel.find({ exam: examId });

// CORRECT - Convert to ObjectId first
const mockTests = await this.mockTestModel.find({ 
  exam: new Types.ObjectId(examId) 
});
```

### Virtual ID Field Handling

When working with virtual `id` fields, extract IDs **before** calling `toObject()`:

```typescript
// WRONG - toObject() deletes _id, virtual getter returns object
const obj = mockTest.toObject();
const examId = obj.exam?.id; // Returns [object Object]

// CORRECT - Extract _id before transformation
const examId = mockTest.exam?._id?.toString();
const obj = mockTest.toObject();
```

---

## DTOs & Validation

### DTO Rules

1. **NEVER use inline interfaces** or anonymous types
2. **Create dedicated DTO files** for all data structures
3. **Use class-validator decorators** for validation
4. **Use class-transformer decorators** for serialization
5. **Export DTOs from index files** for easier imports

**FORBIDDEN:**
```typescript
// Inline interface in controller
async getUsers(): Promise<{ data: { id: string; name: string }[] }> {
  // ...
}

// Anonymous type in service
async findAll(): Promise<{ users: any[]; total: number }> {
  // ...
}
```

**CORRECT:**
```typescript
// dto/user-response.dto.ts
import { ApiProperty, Exclude } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class UserResponseDto {
  @ApiProperty({ description: 'User ID' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'User name' })
  @Expose()
  name: string;

  @Exclude()
  password: string;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}

// dto/paginated-users-response.dto.ts
import { PaginationMetaDto } from '../../common/dto/api-response.dto';
import { UserResponseDto } from './user-response.dto';

export interface PaginatedUsersResponseDto {
  data: UserResponseDto[];
  pagination: PaginationMetaDto;
}
```

### Validation Rules

1. **Use class-validator decorators** for all input validation
2. **Create custom validators** for business logic validation
3. **Provide meaningful error messages**
4. **Use validation groups** when needed

```typescript
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    description: 'User password (min 8 characters)',
    example: 'SecurePass123!',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(50, { message: 'Password must not exceed 50 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain uppercase, lowercase, and number',
  })
  password: string;
}
```

---

## API Response Format

### Standard Response Structure

**ALL API endpoints MUST return this format:**

```typescript
// Success response without pagination
{
  "message": "Operation successful message",
  "data": T // Can be object, array, or primitive
}

// Success response with pagination
{
  "message": "Operation successful message",
  "data": T[],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### Response DTO Types

Use these common DTOs for all responses:

```typescript
import { PaginationMetaDto, ApiResponseDto } from '../common/dto/api-response.dto';

// Simple response
return {
  message: 'User created successfully',
  data: userDto,
};

// Paginated response
return {
  message: 'Users retrieved successfully',
  data: users,
  pagination: {
    total,
    page,
    limit,
    totalPages,
    hasNextPage,
    hasPrevPage,
  },
};
```

### Controller Return Types

**ALWAYS specify explicit return types:**

```typescript
async findAll(
  @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
): Promise<{
  message: string;
  data: UserResponseDto[];
  pagination: PaginationMetaDto;
}> {
  // ...
}
```

---

## Authentication & Authorization

### JWT Authentication

1. **Use Passport JWT Strategy** for authentication
2. **Apply `@UseGuards(JwtAuthGuard)`** to protected routes
3. **Use `@GetUser()` decorator** to access current user
4. **Store minimal data in JWT payload**

### Role-Based Access Control

```typescript
@Post()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
async create(@GetUser() user: UserResponseDto, @Body() dto: CreateDto) {
  // Only admins can access
}
```

### Security Best Practices

1. **Never expose sensitive data** in responses
2. **Use `@Exclude()` decorator** for sensitive fields
3. **Hash passwords** with bcrypt (min 10 rounds)
4. **Validate JWTs** on every request
5. **Implement rate limiting** for authentication endpoints
6. **Use HTTPS only** in production

---

## Error Handling

### Exception Handling

1. **Use built-in NestJS exceptions**
2. **Provide meaningful error messages**
3. **Log errors with context**
4. **Never expose stack traces** in production

```typescript
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';

// Example error handling
async findOne(id: string): Promise<UserResponseDto> {
  const user = await this.userModel.findById(new Types.ObjectId(id));
  
  if (!user) {
    throw new NotFoundException(`User with ID ${id} not found`);
  }
  
  return this.toResponseDto(user);
}
```

### Global Exception Filter

The project uses a global HTTP exception filter that:
- Catches all exceptions
- Formats error responses consistently
- Logs errors with context
- Handles MongoDB errors
- Validates Mongoose validation errors

---

## Documentation

### Swagger/OpenAPI

**EVERY endpoint MUST have:**

1. `@ApiOperation()` - Endpoint description
2. `@ApiResponse()` - Success response
3. `@ApiBadRequestResponse()` - Validation errors
4. `@ApiUnauthorizedResponse()` - Auth errors
5. `@ApiNotFoundResponse()` - Not found errors
6. `@ApiBearerAuth()` - For protected routes

```typescript
@Get(':id')
@ApiOperation({
  summary: 'Get user by ID',
  description: 'Retrieves a single user by their unique identifier',
})
@ApiResponse({
  status: 200,
  description: 'User retrieved successfully',
  type: UserResponseDto,
})
@ApiNotFoundResponse({
  description: 'User not found',
})
@ApiBearerAuth('JWT-auth')
async findOne(@Param('id') id: string): Promise<{
  message: string;
  data: UserResponseDto;
}> {
  const user = await this.usersService.findOne(id);
  return {
    message: 'User retrieved successfully',
    data: user,
  };
}
```

### Code Comments

1. **Document complex business logic**
2. **Explain "why", not "what"**
3. **Use JSDoc for public APIs**
4. **Keep comments up-to-date**

---

## Testing

### Unit Tests

1. **Test all service methods**
2. **Mock external dependencies**
3. **Test edge cases and error scenarios**
4. **Aim for 80%+ code coverage**

### E2E Tests

1. **Test complete user flows**
2. **Use test database**
3. **Clean up after tests**
4. **Test authentication flows**

---

## Code Organization

### File Naming

- **Controllers**: `feature.controller.ts`
- **Services**: `feature.service.ts`
- **DTOs**: `kebab-case.dto.ts`
- **Schemas**: `feature.schema.ts`
- **Interfaces**: `kebab-case.interface.ts`
- **Enums**: `kebab-case.enum.ts`
- **Types**: `kebab-case.types.ts`

### Import Order

```typescript
// 1. External libraries
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';

// 2. Internal modules (absolute imports)
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

// 3. Internal utilities (relative imports)
import { hashPassword } from '../common/utils/crypto.util';
```

### Code Style

1. **Use Prettier** for code formatting
2. **Use ESLint** for code quality
3. **Follow TypeScript conventions**
4. **Keep functions small** (< 50 lines)
5. **Use meaningful variable names**
6. **Avoid deep nesting** (max 3 levels)

---

## Pagination

### Implementation

```typescript
async findAll(
  page: number = 1,
  limit: number = 10,
  search?: string,
): Promise<PaginatedUsersResponseDto> {
  const validPage = Math.max(1, page);
  const validLimit = Math.min(Math.max(1, limit), 100); // Max 100 items
  const skip = (validPage - 1) * validLimit;

  const query: FilterQuery<UserDocument> = {};
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    this.userModel
      .find(query)
      .skip(skip)
      .limit(validLimit)
      .sort({ createdAt: -1 })
      .exec(),
    this.userModel.countDocuments(query),
  ]);

  const totalPages = Math.ceil(total / validLimit);

  return {
    data: users.map(user => this.toResponseDto(user)),
    pagination: {
      total,
      page: validPage,
      limit: validLimit,
      totalPages,
      hasNextPage: validPage < totalPages,
      hasPrevPage: validPage > 1,
    },
  };
}
```

---

## Soft Delete Pattern

### Implementation

**ALWAYS use soft delete, never hard delete:**

```typescript
@Prop({ default: false })
isDeleted: boolean;

@Prop({ type: Date })
deletedAt?: Date;

// Middleware to filter deleted records
UserSchema.pre(/^find/, function (this: Query<unknown, UserDocument>) {
  this.where({ isDeleted: { $ne: true } });
});

// Soft delete method
async remove(id: string): Promise<void> {
  const result = await this.userModel.updateOne(
    { _id: new Types.ObjectId(id) },
    {
      isDeleted: true,
      deletedAt: new Date(),
    },
  );

  if (result.matchedCount === 0) {
    throw new NotFoundException(`User with ID ${id} not found`);
  }
}
```

---

## Performance Optimization

1. **Use indexes** for frequently queried fields
2. **Use `.lean()`** for read-only queries
3. **Use projection** to limit returned fields
4. **Implement caching** for frequently accessed data
5. **Use pagination** for large datasets
6. **Avoid N+1 queries** - use populate wisely
7. **Use bulk operations** when possible

---

## Environment Configuration

1. **Use ConfigModule** from @nestjs/config
2. **Validate environment variables** at startup
3. **Never commit secrets** to repository
4. **Use different configs** for dev/staging/prod
5. **Document all env variables** in README

---

## Git Commit Messages

Follow conventional commits:

```
feat: add user registration endpoint
fix: resolve ObjectId query issue in mock tests
docs: update API documentation
refactor: improve error handling in auth service
test: add unit tests for user service
chore: update dependencies
```

---

## Summary Checklist

Before committing code, verify:

- [ ] No `any` types used
- [ ] All DTOs in separate files (no inline interfaces)
- [ ] Proper TypeScript types for all functions
- [ ] MongoDB queries use `FilterQuery<T>` and `Types.ObjectId()`
- [ ] All responses follow standard format
- [ ] Swagger documentation on all endpoints
- [ ] Validation decorators on all input DTOs
- [ ] Proper error handling with meaningful messages
- [ ] Unit tests written and passing
- [ ] ESLint and Prettier passing
- [ ] No sensitive data in logs or responses
- [ ] Soft delete implemented (never hard delete)
- [ ] Pagination implemented for list endpoints

---

**Last Updated:** 2026-11-05
**Maintained By:** EZ Prep Development Team
