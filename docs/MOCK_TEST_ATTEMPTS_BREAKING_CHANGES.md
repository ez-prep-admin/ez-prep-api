# Mock Test Attempts - Breaking Changes Documentation

**Date:** May 12, 2026  
**Version:** 2.0.0  
**Type:** Breaking Changes

## Overview

This document outlines the breaking changes made to the Mock Test Attempts module. These changes improve API consistency and provide richer data in responses.

---

## 1. Schema Field Rename: `test` → `mockTest`

### Change Description

The field that references the MockTest has been renamed from `test` to `mockTest` in the `MockTestAttempt` schema for better clarity and consistency.

### Files Modified

- `src/mock-test-attempts/schemas/mock-test-attempt.schema.ts`
  - Changed `@Prop` field name from `test` to `mockTest`
  - Updated index from `{ user: 1, test: 1 }` to `{ user: 1, mockTest: 1 }`

### Database Migration

**IMPORTANT:** This is a breaking change that requires a database migration.

#### MongoDB Migration Script

```javascript
// Run this in MongoDB shell or via migration tool
db.mocktestAttempts.updateMany(
  { test: { $exists: true } },
  { $rename: { test: 'mockTest' } }
);

// Verify migration
db.mocktestAttempts.find({ test: { $exists: true } }).count(); // Should return 0
db.mocktestAttempts.find({ mockTest: { $exists: true } }).count(); // Should return total count

// Drop old index and create new one
db.mocktestAttempts.dropIndex({ user: 1, test: 1 });
db.mocktestAttempts.createIndex({ user: 1, mockTest: 1 });
```

### Code Impact

All queries and references to `attempt.test` have been updated to `attempt.mockTest`:

- Service methods in `mock-test-attempts.service.ts`
- Related queries in `mock-tests.service.ts`
- All populate and aggregation operations

---

## 2. Enhanced API Responses with Populated Data

### Change Description

All APIs that return mock test attempt information now include populated exam, subject, and topic details (name, id, and description where available).

### Affected Endpoints

#### 1. `GET /api/v1/mock-test-attempts/my-attempts`

**Before:**
```json
{
  "message": "Your attempts retrieved successfully",
  "data": [
    {
      "attemptId": "...",
      "mockTestId": "...",
      "mockTestTitle": "Sample Test",
      "status": "submitted",
      "score": 85,
      "totalMarks": 100,
      "startedAt": "2024-01-01T00:00:00Z",
      "submittedAt": "2024-01-01T01:00:00Z"
    }
  ],
  "count": 1
}
```

**After:**
```json
{
  "message": "Your attempts retrieved successfully",
  "data": [
    {
      "attemptId": "...",
      "mockTestId": "...",
      "mockTestTitle": "Sample Test",
      "exam": {
        "id": "...",
        "name": "UPSC Civil Services",
        "description": "Union Public Service Commission Civil Services Examination"
      },
      "subject": {
        "id": "...",
        "name": "General Studies",
        "description": "General Studies for UPSC"
      },
      "topic": {
        "id": "...",
        "name": "Indian Polity",
        "description": "Constitution and Governance"
      },
      "status": "submitted",
      "score": 85,
      "totalMarks": 100,
      "startedAt": "2024-01-01T00:00:00Z",
      "submittedAt": "2024-01-01T01:00:00Z"
    }
  ],
  "count": 1
}
```

#### 2. `GET /api/v1/mock-test-attempts/my-attempts/{mockTestId}`

**Same enhancement as above** - now includes exam, subject, and topic information for each attempt.

#### 3. `GET /api/v1/mock-test-attempts/{attemptId}`

**Before:**
```json
{
  "message": "Attempt details retrieved successfully",
  "data": {
    "attemptId": "...",
    "status": "submitted",
    "test": {
      "title": "Sample Test",
      "durationInMinutes": 60,
      "totalQuestions": 10,
      "startedAt": "2024-01-01T00:00:00Z",
      "marksPerQuestion": 4,
      "negativeMarking": 1,
      "passingScore": 30,
      "showResultsImmediately": true
    },
    "questions": [...],
    "score": 36,
    "correctAnswers": 9,
    "incorrectAnswers": 1,
    "unansweredQuestions": 0,
    "isPassed": true,
    "submittedAt": "2024-01-01T01:00:00Z"
  }
}
```

**After:**
```json
{
  "message": "Attempt details retrieved successfully",
  "data": {
    "attemptId": "...",
    "status": "submitted",
    "test": {
      "title": "Sample Test",
      "durationInMinutes": 60,
      "totalQuestions": 10,
      "startedAt": "2024-01-01T00:00:00Z",
      "marksPerQuestion": 4,
      "negativeMarking": 1,
      "passingScore": 30,
      "showResultsImmediately": true,
      "exam": {
        "id": "...",
        "name": "UPSC Civil Services",
        "description": "Union Public Service Commission Civil Services Examination"
      },
      "subject": {
        "id": "...",
        "name": "General Studies",
        "description": "General Studies for UPSC"
      },
      "topic": {
        "id": "...",
        "name": "Indian Polity",
        "description": "Constitution and Governance"
      }
    },
    "questions": [...],
    "score": 36,
    "correctAnswers": 9,
    "incorrectAnswers": 1,
    "unansweredQuestions": 0,
    "isPassed": true,
    "submittedAt": "2024-01-01T01:00:00Z"
  }
}
```

### Files Modified

#### DTOs
- `src/mock-test-attempts/dto/user-attempt-summary.dto.ts`
  - Added `BasicInfoDto` class for exam/subject/topic
  - Added `exam`, `subject`, and `topic` fields to `UserAttemptSummaryDto`
  - Updated status enum to include 'expired'

- `src/mock-test-attempts/dto/attempt-detail-response.dto.ts`
  - Added `BasicInfoDto` class for exam/subject/topic
  - Added `exam`, `subject`, and `topic` fields to `TestMetadataDto`

#### Service Methods
- `src/mock-test-attempts/mock-test-attempts.service.ts`
  - `findUserAttempts()`: Now populates and includes exam, subject, topic in response
  - `findUserTestAttempts()`: Now populates and includes exam, subject, topic in response
  - `findOne()`: Now populates and includes exam, subject, topic in response

#### Controller
- `src/mock-test-attempts/mock-test-attempts.controller.ts`
  - Updated Swagger documentation for affected endpoints
  - Updated return types to include new fields

---

## 3. TypeScript Type Updates

### New Types

```typescript
export class BasicInfoDto {
  id: string;
  name: string;
  description?: string;
}
```

This type is used consistently across all populated exam, subject, and topic fields.

---

## Migration Checklist

### Backend

- [x] Update schema field name from `test` to `mockTest`
- [x] Update all service queries and references
- [x] Update DTOs to include exam, subject, topic
- [x] Update Swagger documentation
- [x] Update database indexes
- [ ] Run database migration script
- [ ] Test all affected endpoints

### Frontend (if applicable)

- [ ] Update API response interfaces/types
- [ ] Update field references from `test` to `mockTest` (if directly accessing schema)
- [ ] Update UI to display exam, subject, topic information
- [ ] Test all affected pages/components
- [ ] Update any cached data structures

### Database

- [ ] Backup database before migration
- [ ] Run field rename migration
- [ ] Update indexes
- [ ] Verify data integrity after migration
- [ ] Monitor query performance

---

## Rollback Plan

If issues arise, you can rollback using this MongoDB script:

```javascript
// Rollback field rename
db.mocktestAttempts.updateMany(
  { mockTest: { $exists: true } },
  { $rename: { mockTest: 'test' } }
);

// Rollback index
db.mocktestAttempts.dropIndex({ user: 1, mockTest: 1 });
db.mocktestAttempts.createIndex({ user: 1, test: 1 });
```

---

## Testing Recommendations

1. **Unit Tests**: Verify service methods return correct data structure
2. **Integration Tests**: Test all affected API endpoints
3. **Database Tests**: Verify queries work with new field name
4. **Performance Tests**: Ensure population doesn't significantly impact response times
5. **E2E Tests**: Test complete user flows involving attempts

---

## Benefits of These Changes

1. **Better Clarity**: `mockTest` is more descriptive than `test`
2. **Richer Data**: Exam, subject, and topic details eliminate need for additional API calls
3. **Improved UX**: Frontend can display more context without extra requests
4. **Consistency**: Follows naming conventions used elsewhere in the codebase
5. **Better Documentation**: Swagger docs now properly reflect the response structure

---

## Questions or Issues?

If you encounter any issues or have questions about these changes, please:

1. Check this documentation first
2. Review the code changes in the affected files
3. Run the test suite to identify specific failures
4. Contact the development team for support

---

**Document Version:** 1.0  
**Last Updated:** May 12, 2026  
**Reviewed By:** [Team Member Name]
