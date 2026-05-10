# Mock Test Pause/Resume API Documentation

## Overview

The pause/resume functionality allows users to pause an in-progress mock test attempt and resume it later, with accurate time tracking across multiple pause/resume cycles. This feature provides flexibility for users who cannot complete exams in one sitting due to interruptions, network issues, or other constraints.

---

## Key Features

✅ **Unlimited Pause/Resume Cycles** - No restrictions on how many times users can pause  
✅ **10-Second Grace Period** - Accounts for network latency and frontend processing  
✅ **Complete Audit Trail** - All pause/resume events tracked with timestamps  
✅ **Accurate Time Tracking** - Single source of truth via `calculateTimeElapsed()` helper  
✅ **Progress Preservation** - All selected answers maintained during pause  
✅ **Security** - Cannot update answers while paused; must resume first  
✅ **Auto-Expire Protection** - Paused attempts won't auto-expire  
✅ **Fair Time Tracking** - Time only counts when test is actively IN_PROGRESS  

---

## Architecture: Single Source of Truth

### Time Calculation Strategy

All time-related operations use the **`calculateTimeElapsed()`** helper method as the single source of truth:

```typescript
private calculateTimeElapsed(attempt: MockTestAttemptDocument): number {
  // If paused, return the saved timeConsumed
  if (attempt.status === 'PAUSED') {
    return attempt.timeConsumed || 0;
  }

  // For IN_PROGRESS: accumulated time + current session time
  const currentSessionTime = Math.floor(
    (Date.now() - attempt.startedAt.getTime()) / 1000,
  );
  return (attempt.timeConsumed || 0) + currentSessionTime;
}
```

**How it works:**
- **PAUSED attempts**: Returns saved `timeConsumed` (frozen time)
- **IN_PROGRESS attempts**: Returns `timeConsumed + (now - startedAt)`
- **First session** (never paused): `timeConsumed = 0`, so it's just `(now - startedAt)`
- **After resume**: `startedAt` is reset, `timeConsumed` holds previous time

### Database Schema Updates

```typescript
@Schema()
export class MockTestAttempt {
  // Status now includes PAUSED
  @Prop({
    type: String,
    enum: ['IN_PROGRESS', 'PAUSED', 'SUBMITTED', 'EXPIRED'],
    default: 'IN_PROGRESS',
  })
  status: string;

  // Accumulated time across pause/resume cycles (in seconds)
  @Prop({ type: Number, default: 0 })
  timeConsumed: number;

  // When the attempt was last paused
  @Prop()
  pausedAt?: Date;

  // Audit trail of all pause/resume events
  @Prop({ type: [PauseResumeEventSchema], default: [] })
  pauseResumeHistory: PauseResumeEvent[];
}

@Schema({ _id: false })
export class PauseResumeEvent {
  @Prop({ type: String, enum: ['PAUSE', 'RESUME'], required: true })
  action: string;

  @Prop({ type: Date, required: true })
  timestamp: Date;

  @Prop({ type: Number })
  timeConsumedAtPause?: number;
}
```

---

## API Endpoints

### 1. **Start Test** (Existing - No Changes Needed)

**Endpoint:** `POST /api/v1/mock-test-attempts/start`

**Purpose:** Initiates a new mock test attempt with frozen configuration.

**Request Body:**
```json
{
  "mockTestId": "67c5f4ee4d671dbf0cb95a10"
}
```

**Response:**
```json
{
  "message": "Mock test attempt started successfully",
  "data": {
    "attemptId": "6a009ed610e11f12cc6d094f",
    "mockTestData": {
      "title": "Daily Practice Test 1",
      "durationInMinutes": 30,
      "totalQuestions": 30,
      "startedAt": "2026-05-11T10:00:00.000Z",
      "marksPerQuestion": 4,
      "negativeMarking": 1,
      "passingScore": 20,
      "exam": {
        "id": "67bcc413003af8ad9fae3585",
        "name": "SSC CGL",
        "description": "Staff Selection Commission Combined Graduate Level"
      },
      "subject": {
        "id": "67bcc413003af8ad9fae3586",
        "name": "General Awareness",
        "description": "Current affairs and general knowledge"
      },
      "topic": {
        "id": "67bb62fdce13ea033146f0cb",
        "name": "History"
      }
    },
    "questions": [
      {
        "_id": "67c5f4ee4d671dbf0cb95a12",
        "questionText": {
          "en": {
            "text": "Which period came first?",
            "imageUrl": null
          },
          "ml": {
            "text": null,
            "imageUrl": null
          }
        },
        "optionType": "text",
        "options": [
          {
            "id": "fe99dedc-7c4b-445a-9c5f-03e5706bf184",
            "type": "text",
            "en": "Palaeolithic Period",
            "ml": null,
            "imageUrl": null
          }
          // ... more options
        ],
        "subject": "67bcc413003af8ad9fae3585",
        "topic": "67bb62fdce13ea033146f0cb",
        "difficultyLevel": "medium"
      }
      // ... more questions
    ]
  }
}
```

**Time Tracking Initialization:**
- `startedAt` is set to current timestamp
- `timeConsumed` = 0 (initialized)
- `status` = 'IN_PROGRESS'

---

### 2. **Update Answer** (Existing)

**Endpoint:** `PATCH /api/v1/mock-test-attempts/:attemptId/answer`

**Purpose:** Save user's answer for a specific question.

**Request Body:**
```json
{
  "questionId": "67c5f4ee4d671dbf0cb95a12",
  "selectedOptionId": "fe99dedc-7c4b-445a-9c5f-03e5706bf184"
}
```

**Response:** `204 No Content`

**Validations:**
- ✅ Attempt must be IN_PROGRESS (NOT PAUSED)
- ✅ Time must not have expired (uses `calculateTimeElapsed()`)
- ✅ Question must be part of the attempt

**Time Check:**
```typescript
const timeElapsed = this.calculateTimeElapsed(attempt);
const allowedTime = attempt.durationInMinutes * 60;

if (timeElapsed > allowedTime) {
  // Auto-expire and reject update
  throw new BadRequestException('Test has expired');
}
```

---

### 3. **Pause Test** ✨ NEW!

**Endpoint:** `POST /api/v1/mock-test-attempts/:attemptId/pause`

**Purpose:** Pauses an active test, saving progress and current time consumption.

**Request Body:** None (attemptId in URL)

**Response:**
```json
{
  "message": "Mock test attempt paused successfully",
  "data": {
    "attemptId": "6a009ed610e11f12cc6d094f",
    "testTitle": "Daily Practice Test 1",
    "status": "PAUSED",
    "timeConsumed": 450,
    "timeRemaining": 1350,
    "pausedAt": "2026-05-11T10:07:30.000Z",
    "pauseCount": 1,
    "recentHistory": [
      {
        "action": "PAUSE",
        "timestamp": "2026-05-11T10:07:30.000Z",
        "timeConsumedAtPause": 450
      }
    ]
  }
}
```

**Process Flow:**
1. Validates attempt exists and belongs to user
2. Checks status is IN_PROGRESS
3. Calculates total time consumed:
   ```typescript
   const currentSessionTime = Math.floor(
     (Date.now() - attempt.startedAt.getTime()) / 1000,
   );
   const totalTimeConsumed = 
     (attempt.timeConsumed || 0) + currentSessionTime + GRACE_PERIOD_SECONDS;
   ```
4. Verifies time remaining > 0 (can't pause expired test)
5. Updates attempt:
   - `status` → 'PAUSED'
   - `timeConsumed` → totalTimeConsumed
   - `pausedAt` → current timestamp
   - Adds PAUSE event to `pauseResumeHistory`
6. Returns time metrics and history

**Grace Period:** 10 seconds added to account for network delays and UI rendering.

**Validations:**
- ❌ Cannot pause if already PAUSED
- ❌ Cannot pause if SUBMITTED or EXPIRED
- ❌ Cannot pause if time already exceeded

---

### 4. **Resume Test** (Enhanced)

**Endpoint:** `GET /api/v1/mock-test-attempts/:attemptId/resume`

**Purpose:** Resumes a paused test or retrieves in-progress test state (reload/reconnect).

**Request:** None (attemptId in URL)

**Response:**
```json
{
  "attemptId": "6a009ed610e11f12cc6d094f",
  "test": {
    "title": "Daily Practice Test 1",
    "durationInMinutes": 30,
    "totalQuestions": 30,
    "startedAt": "2026-05-11T10:15:00.000Z",  // Reset when resumed!
    "marksPerQuestion": 4,
    "negativeMarking": 1,
    "passingScore": 20
  },
  "questions": [
    {
      "_id": "67c5f4ee4d671dbf0cb95a12",
      "questionText": {
        "en": {
          "text": "Which period came first?",
          "imageUrl": null
        },
        "ml": {
          "text": null,
          "imageUrl": null
        }
      },
      "optionType": "text",
      "options": [ /* options without correct answer */ ],
      "subject": "67bcc413003af8ad9fae3585",
      "topic": "67bb62fdce13ea033146f0cb",
      "difficultyLevel": "medium",
      "selectedOption": "fe99dedc-7c4b-445a-9c5f-03e5706bf184"  // Preserved
    }
    // ... more questions
  ],
  "timeElapsed": 450,      // Accurate across pause/resume
  "timeRemaining": 1350,   // Based on timeConsumed
  "pauseCount": 1,         // How many times paused
  "timeConsumed": 450      // Total time consumed so far
}
```

**Process Flow:**

**For PAUSED attempts:**
1. Detects status is PAUSED
2. Updates `status` → 'IN_PROGRESS'
3. **Resets `startedAt`** to current time (new session begins)
4. Adds RESUME event to history
5. Calculates time using accumulated `timeConsumed`:
   ```typescript
   const currentSessionTime = Math.floor(
     (Date.now() - attempt.startedAt.getTime()) / 1000,
   );
   timeElapsed = (attempt.timeConsumed || 0) + currentSessionTime;
   ```

**For IN_PROGRESS attempts:**
1. Returns current state (reload/reconnect scenario)
2. Calculates time normally from `startedAt`

**Security:**
- ❌ Does NOT include correct answers
- ❌ Does NOT include explanations
- ✅ Includes user's selected answers

---

### 5. **Submit Test** (Enhanced)

**Endpoint:** `POST /api/v1/mock-test-attempts/:attemptId/submit`

**Purpose:** Submits test for evaluation, handles late submissions with grace period.

**Request Body (Optional):**
```json
{
  "answers": [
    {
      "questionId": "67c5f4ee4d671dbf0cb95a12",
      "selectedOptionId": "fe99dedc-7c4b-445a-9c5f-03e5706bf184"
    }
    // ... more answers
  ]
}
```

**Response:**
```json
{
  "attemptId": "6a009ed610e11f12cc6d094f",
  "score": 92,
  "totalScore": 120,
  "passingScore": 20,
  "passed": true,
  "correctAnswers": 25,
  "incorrectAnswers": 3,
  "unansweredQuestions": 2,
  "submittedAt": "2026-05-11T10:30:00.000Z",
  "timeTaken": 1800,
  "questionResults": [
    {
      "questionId": "67c5f4ee4d671dbf0cb95a12",
      "selectedOption": "fe99dedc-7c4b-445a-9c5f-03e5706bf184",
      "correctAnswer": "fe99dedc-7c4b-445a-9c5f-03e5706bf184",
      "isCorrect": true,
      "marksAwarded": 4,
      "explanation": {
        "en": "Palaeolithic Period was the earliest...",
        "ml": null,
        "imageUrl": null
      }
    }
    // ... more results
  ]
}
```

**Process Flow:**
1. Validates attempt is IN_PROGRESS
2. **Calculates time using `calculateTimeElapsed()`:**
   ```typescript
   const timeElapsed = this.calculateTimeElapsed(attempt);
   const allowedTime = attempt.durationInMinutes * 60;
   const isExpired = timeElapsed > allowedTime;
   ```
3. Applies 10-second grace period for answer acceptance:
   - If within time: Accept all answers
   - If expired by ≤10s: Accept answers (network tolerance)
   - If expired by >10s: Reject answers, evaluate existing only
4. Evaluates each question against correct answers
5. Calculates score with negative marking
6. Updates attempt: `status` → 'SUBMITTED' or 'EXPIRED'
7. Returns results (if `showResultsImmediately` = true)

**Time Tracking Benefit:**
- Even with multiple pause/resume cycles, time is accurately calculated
- Grace period prevents unfair penalization due to network issues

---

## Complete User Flow

### Scenario 1: Normal Test (No Pause)

```
1. Start Test
   POST /start
   → startedAt = T0, timeConsumed = 0, status = IN_PROGRESS

2. Answer Questions
   PATCH /:attemptId/answer (multiple times)
   → Time check: (now - T0) < allowedTime

3. Submit Test
   POST /:attemptId/submit
   → Time check: (now - T0) < allowedTime + 10s grace
   → Evaluate and return results
```

**Time Calculation:**
```
timeElapsed = (now - startedAt) + timeConsumed
timeElapsed = (now - T0) + 0
timeElapsed = actual time since start
```

---

### Scenario 2: Test with Single Pause

```
1. Start Test
   POST /start
   → startedAt = T0, timeConsumed = 0, status = IN_PROGRESS

2. Answer Some Questions (7 minutes)
   PATCH /:attemptId/answer (multiple times)

3. Pause Test (at 7 minutes)
   POST /:attemptId/pause
   → timeConsumed = (now - T0) + 0 + 10s = 430s
   → status = PAUSED
   → pausedAt = T1

4. User Takes Break (15 minutes - NOT COUNTED)

5. Resume Test
   GET /:attemptId/resume
   → status = IN_PROGRESS
   → startedAt = T2 (reset!)
   → timeConsumed = 430s (preserved)
   → Returns: timeRemaining = 1800 - 430 = 1370s

6. Continue Answering (20 more minutes)
   PATCH /:attemptId/answer

7. Submit Test
   POST /:attemptId/submit
   → timeElapsed = timeConsumed + (now - T2)
   → timeElapsed = 430 + 1200 = 1630s (27.2 minutes)
   → Within 30-minute limit, test evaluated
```

**Time Calculation During Resume:**
```
timeElapsed = timeConsumed + (now - startedAt)
timeElapsed = 430 + (now - T2)
timeElapsed = previous session + current session
```

---

### Scenario 3: Multiple Pause/Resume Cycles

```
1. Start: startedAt = T0, timeConsumed = 0

2. Work 5 minutes → Pause
   → timeConsumed = 310s
   → status = PAUSED

3. Resume: startedAt = T1
   → timeConsumed = 310s (preserved)

4. Work 10 minutes → Pause
   → timeConsumed = 310 + 600 + 10 = 920s
   → status = PAUSED

5. Resume: startedAt = T2
   → timeConsumed = 920s (preserved)

6. Work 12 minutes → Submit
   → timeElapsed = 920 + 720 = 1640s (27.3 min)
   → Total active time: ~27 minutes (within 30-minute limit)
```

**Audit Trail:**
```json
{
  "pauseResumeHistory": [
    {
      "action": "PAUSE",
      "timestamp": "2026-05-11T10:05:00.000Z",
      "timeConsumedAtPause": 310
    },
    {
      "action": "RESUME",
      "timestamp": "2026-05-11T10:10:00.000Z"
    },
    {
      "action": "PAUSE",
      "timestamp": "2026-05-11T10:20:00.000Z",
      "timeConsumedAtPause": 920
    },
    {
      "action": "RESUME",
      "timestamp": "2026-05-11T10:25:00.000Z"
    }
  ]
}
```

---

## Testing Guide

### Prerequisites

```bash
# Set your API base URL
export BASE_URL="http://localhost:3000/api/v1"

# Login to get JWT token (replace with your credentials)
export TOKEN=$(curl -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"password123"}' \
  | jq -r '.data.accessToken')

# Get a mock test ID (from your database or API)
export MOCK_TEST_ID="67c5f4ee4d671dbf0cb95a10"
```

### Test Case 1: Complete Flow with Pause/Resume

#### Step 1: Start Test
```bash
curl -X POST "$BASE_URL/mock-test-attempts/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mockTestId": "'$MOCK_TEST_ID'"
  }' | jq '.'

# Save the attemptId from response
export ATTEMPT_ID="6a009ed610e11f12cc6d094f"
```

**Expected Response:**
- Status: 201 Created
- Contains attemptId, mockTestData with exam/subject/topic, questions array
- startedAt is set to current time

#### Step 2: Answer Some Questions
```bash
# Get the first question ID from start response
export QUESTION_1="67c5f4ee4d671dbf0cb95a12"
export OPTION_1="fe99dedc-7c4b-445a-9c5f-03e5706bf184"

curl -X PATCH "$BASE_URL/mock-test-attempts/$ATTEMPT_ID/answer" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "questionId": "'$QUESTION_1'",
    "selectedOptionId": "'$OPTION_1'"
  }'

# Answer a few more questions
export QUESTION_2="67c5f5b62548058025b23418"
export OPTION_2="2978e3ca-e781-4ea6-8ca0-e7211f0097d1"

curl -X PATCH "$BASE_URL/mock-test-attempts/$ATTEMPT_ID/answer" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "questionId": "'$QUESTION_2'",
    "selectedOptionId": "'$OPTION_2'"
  }'
```

**Expected Response:**
- Status: 204 No Content
- Answers saved successfully

#### Step 3: Pause Test
```bash
curl -X POST "$BASE_URL/mock-test-attempts/$ATTEMPT_ID/pause" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'
```

**Expected Response:**
```json
{
  "message": "Mock test attempt paused successfully",
  "data": {
    "attemptId": "6a009ed610e11f12cc6d094f",
    "testTitle": "Daily Practice Test 1",
    "status": "PAUSED",
    "timeConsumed": 150,
    "timeRemaining": 1650,
    "pausedAt": "2026-05-11T10:02:30.000Z",
    "pauseCount": 1,
    "recentHistory": [
      {
        "action": "PAUSE",
        "timestamp": "2026-05-11T10:02:30.000Z",
        "timeConsumedAtPause": 150
      }
    ]
  }
}
```

**Verify:**
- ✅ Status is PAUSED
- ✅ timeConsumed shows elapsed time + 10s grace
- ✅ timeRemaining = 1800 - timeConsumed
- ✅ pauseCount = 1

#### Step 4: Try to Answer While Paused (Should Fail)
```bash
curl -X PATCH "$BASE_URL/mock-test-attempts/$ATTEMPT_ID/answer" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "questionId": "'$QUESTION_1'",
    "selectedOptionId": "'$OPTION_1'"
  }' | jq '.'
```

**Expected Response:**
- Status: 400 Bad Request
- Error: "Cannot update answers for attempt with status PAUSED"

#### Step 5: Wait 30 Seconds (Simulate Break)
```bash
echo "Simulating user break..."
sleep 30
echo "Break over, resuming test..."
```

#### Step 6: Resume Test
```bash
curl -X GET "$BASE_URL/mock-test-attempts/$ATTEMPT_ID/resume" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

**Expected Response:**
```json
{
  "attemptId": "6a009ed610e11f12cc6d094f",
  "test": {
    "title": "Daily Practice Test 1",
    "durationInMinutes": 30,
    "totalQuestions": 30,
    "startedAt": "2026-05-11T10:03:00.000Z",  // NEW timestamp!
    "marksPerQuestion": 4,
    "negativeMarking": 1,
    "passingScore": 20
  },
  "questions": [ /* questions with selectedOption preserved */ ],
  "timeElapsed": 150,
  "timeRemaining": 1650,
  "pauseCount": 1,
  "timeConsumed": 150
}
```

**Verify:**
- ✅ Status changed to IN_PROGRESS (backend updated)
- ✅ startedAt is NEW (reset for current session)
- ✅ timeConsumed preserved (150s)
- ✅ timeRemaining correct
- ✅ Previous answers preserved in questions array

#### Step 7: Continue Answering
```bash
export QUESTION_3="67c5f6c7a9b8d3e4f1234567"
export OPTION_3="a1b2c3d4-e5f6-7890-abcd-ef1234567890"

curl -X PATCH "$BASE_URL/mock-test-attempts/$ATTEMPT_ID/answer" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "questionId": "'$QUESTION_3'",
    "selectedOptionId": "'$OPTION_3'"
  }'
```

**Expected Response:**
- Status: 204 No Content
- Answer saved successfully

#### Step 8: Pause Again (Testing Multiple Cycles)
```bash
# Wait 1 minute
sleep 60

curl -X POST "$BASE_URL/mock-test-attempts/$ATTEMPT_ID/pause" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

**Expected Response:**
```json
{
  "message": "Mock test attempt paused successfully",
  "data": {
    "attemptId": "6a009ed610e11f12cc6d094f",
    "testTitle": "Daily Practice Test 1",
    "status": "PAUSED",
    "timeConsumed": 220,  // 150 (previous) + 60 (current) + 10 (grace)
    "timeRemaining": 1580,
    "pausedAt": "2026-05-11T10:04:00.000Z",
    "pauseCount": 2,
    "recentHistory": [
      {
        "action": "PAUSE",
        "timestamp": "2026-05-11T10:02:30.000Z",
        "timeConsumedAtPause": 150
      },
      {
        "action": "RESUME",
        "timestamp": "2026-05-11T10:03:00.000Z"
      },
      {
        "action": "PAUSE",
        "timestamp": "2026-05-11T10:04:00.000Z",
        "timeConsumedAtPause": 220
      }
    ]
  }
}
```

**Verify:**
- ✅ pauseCount = 2
- ✅ timeConsumed accumulated correctly
- ✅ History shows all events

#### Step 9: Resume Again
```bash
curl -X GET "$BASE_URL/mock-test-attempts/$ATTEMPT_ID/resume" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

**Expected Response:**
- ✅ New startedAt timestamp
- ✅ timeConsumed = 220
- ✅ pauseCount = 2

#### Step 10: Submit Test
```bash
# Optionally include last-minute answers
curl -X POST "$BASE_URL/mock-test-attempts/$ATTEMPT_ID/submit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [
      {
        "questionId": "'$QUESTION_1'",
        "selectedOptionId": "'$OPTION_1'"
      }
    ]
  }' | jq '.'
```

**Expected Response:**
```json
{
  "attemptId": "6a009ed610e11f12cc6d094f",
  "score": 96,
  "totalScore": 120,
  "passingScore": 20,
  "passed": true,
  "correctAnswers": 26,
  "incorrectAnswers": 2,
  "unansweredQuestions": 2,
  "submittedAt": "2026-05-11T10:10:00.000Z",
  "timeTaken": 580,  // Total active time across all sessions
  "questionResults": [ /* detailed results */ ]
}
```

**Verify:**
- ✅ timeTaken reflects actual active time (not break time)
- ✅ Score calculated correctly
- ✅ Detailed results included (if showResultsImmediately = true)

---

### Test Case 2: Time Expiry During Active Session

```bash
# Assuming a test with 1-minute duration for quick testing

# Step 1: Start test
curl -X POST "$BASE_URL/mock-test-attempts/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mockTestId": "'$SHORT_TEST_ID'"}' | jq '.'

export ATTEMPT_ID="..."

# Step 2: Wait 70 seconds (past 60-second limit)
sleep 70

# Step 3: Try to update answer (should fail)
curl -X PATCH "$BASE_URL/mock-test-attempts/$ATTEMPT_ID/answer" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "questionId": "'$QUESTION_1'",
    "selectedOptionId": "'$OPTION_1'"
  }' | jq '.'
```

**Expected Response:**
- Status: 400 Bad Request
- Error: "Test has expired. You can no longer update answers."

---

### Test Case 3: Grace Period on Submit

```bash
# Step 1: Start test with 1-minute duration
curl -X POST "$BASE_URL/mock-test-attempts/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mockTestId": "'$SHORT_TEST_ID'"}' | jq '.'

export ATTEMPT_ID="..."

# Step 2: Wait 65 seconds (5 seconds past limit, within 10s grace)
sleep 65

# Step 3: Submit with answers (should be accepted)
curl -X POST "$BASE_URL/mock-test-attempts/$ATTEMPT_ID/submit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [
      {
        "questionId": "'$QUESTION_1'",
        "selectedOptionId": "'$OPTION_1'"
      }
    ]
  }' | jq '.'
```

**Expected Response:**
- Status: 200 OK
- Answers accepted (within grace period)
- Results returned

---

### Test Case 4: Beyond Grace Period

```bash
# Step 1: Start test
export ATTEMPT_ID="..."

# Step 2: Wait 75 seconds (15 seconds past limit, beyond grace)
sleep 75

# Step 3: Submit with answers (answers should be rejected)
curl -X POST "$BASE_URL/mock-test-attempts/$ATTEMPT_ID/submit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [
      {
        "questionId": "'$QUESTION_1'",
        "selectedOptionId": "'$OPTION_1'"
      }
    ]
  }' | jq '.'
```

**Expected Response:**
- Status: 200 OK
- Test evaluated but new answers rejected
- Only previously saved answers counted
- Console log: "Answers rejected - timer exceeded by X seconds"

---

## Error Scenarios

### 1. Pause Already Paused Test
```bash
curl -X POST "$BASE_URL/mock-test-attempts/$ATTEMPT_ID/pause" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
- Status: 400 Bad Request
- Error: "Cannot pause attempt with status PAUSED. Only IN_PROGRESS attempts can be paused."

### 2. Resume Submitted Test
```bash
curl -X GET "$BASE_URL/mock-test-attempts/$SUBMITTED_ATTEMPT_ID/resume" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
- Status: 400 Bad Request
- Error: "Cannot resume attempt with status SUBMITTED. Use GET /:id endpoint to view results."

### 3. Pause Expired Test
```bash
# After time limit exceeded
curl -X POST "$BASE_URL/mock-test-attempts/$ATTEMPT_ID/pause" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
- Status: 400 Bad Request
- Error: "Cannot pause: Test time has already expired. Please submit the test."

---

## Frontend Implementation Tips

### 1. Timer Management

```typescript
class TestTimer {
  private intervalId: NodeJS.Timeout | null = null;
  private startedAt: Date;
  private timeConsumed: number; // from API
  private durationInMinutes: number;

  start(startedAt: Date, timeConsumed: number = 0, duration: number) {
    this.startedAt = startedAt;
    this.timeConsumed = timeConsumed;
    this.durationInMinutes = duration;
    
    this.intervalId = setInterval(() => {
      this.updateDisplay();
    }, 1000);
  }

  updateDisplay() {
    const currentSessionTime = Math.floor(
      (Date.now() - this.startedAt.getTime()) / 1000
    );
    const totalElapsed = this.timeConsumed + currentSessionTime;
    const allowedTime = this.durationInMinutes * 60;
    const remaining = Math.max(0, allowedTime - totalElapsed);
    
    // Update UI with remaining time
    this.displayTime(remaining);
    
    // Auto-submit if time runs out
    if (remaining === 0) {
      this.autoSubmit();
    }
  }

  pause() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  resume(newStartedAt: Date, timeConsumed: number) {
    this.startedAt = newStartedAt;
    this.timeConsumed = timeConsumed;
    this.start(newStartedAt, timeConsumed, this.durationInMinutes);
  }
}
```

### 2. Handle Page Reload

```typescript
// On component mount
useEffect(() => {
  const attemptId = getAttemptIdFromUrl();
  
  // Always call resume to get latest state
  fetch(`/api/v1/mock-test-attempts/${attemptId}/resume`)
    .then(res => res.json())
    .then(data => {
      // Restore state
      setQuestions(data.questions);
      setTimeConsumed(data.timeConsumed || 0);
      
      // Start timer with correct base
      timer.start(
        new Date(data.test.startedAt),
        data.timeConsumed || 0,
        data.test.durationInMinutes
      );
    });
}, []);
```

### 3. Handle Network Interruption

```typescript
// Periodically save answers (every 30 seconds)
useEffect(() => {
  const autoSaveInterval = setInterval(() => {
    saveCurrentAnswers();
  }, 30000);
  
  return () => clearInterval(autoSaveInterval);
}, []);

// On network reconnection
window.addEventListener('online', () => {
  // Sync any pending answers
  syncPendingAnswers();
  
  // Refresh attempt state
  resumeAttempt(attemptId);
});
```

---

## Database Queries for Monitoring

### 1. Find All Paused Attempts
```javascript
db.mocktestattepts.find({
  status: 'PAUSED',
  pausedAt: { $exists: true }
}).sort({ pausedAt: -1 });
```

### 2. Find Attempts with Multiple Pauses
```javascript
db.mocktestattepts.aggregate([
  {
    $addFields: {
      pauseCount: {
        $size: {
          $filter: {
            input: '$pauseResumeHistory',
            as: 'event',
            cond: { $eq: ['$$event.action', 'PAUSE'] }
          }
        }
      }
    }
  },
  {
    $match: { pauseCount: { $gte: 2 } }
  },
  {
    $sort: { pauseCount: -1 }
  }
]);
```

### 3. Average Time Consumed Before First Pause
```javascript
db.mocktestattepts.aggregate([
  {
    $match: {
      'pauseResumeHistory.0': { $exists: true }
    }
  },
  {
    $project: {
      firstPauseTime: { $arrayElemAt: ['$pauseResumeHistory.timeConsumedAtPause', 0] }
    }
  },
  {
    $group: {
      _id: null,
      avgTimeToFirstPause: { $avg: '$firstPauseTime' }
    }
  }
]);
```

---

## Performance Considerations

### 1. Index Optimization
```javascript
// Compound index for status and user queries
db.mocktestattepts.createIndex({ user: 1, status: 1 });

// Index for paused attempts
db.mocktestattepts.createIndex({ status: 1, pausedAt: 1 });
```

### 2. History Array Growth
The `pauseResumeHistory` array grows with each pause/resume cycle. Consider:
- Limiting history to last 20 events (if needed)
- Moving old history to separate collection for analytics
- Current implementation returns only last 5 events in pause response

---

## Security Considerations

1. **User Authorization:** All endpoints verify attempt belongs to authenticated user
2. **No Answer Leakage:** Resume endpoint excludes correct answers and explanations
3. **Time Manipulation Prevention:** All time calculations done server-side
4. **Grace Period Limits:** 10-second grace prevents abuse while allowing network tolerance
5. **Status Validation:** Cannot perform operations on incorrect status (e.g., answer while paused)

---

## Conclusion

The pause/resume implementation provides a robust, fair, and user-friendly way to handle test interruptions while maintaining:
- ✅ **Accuracy:** Single source of truth for time calculations
- ✅ **Flexibility:** Unlimited pause/resume cycles
- ✅ **Fairness:** Grace periods for network issues
- ✅ **Security:** Server-side validation and time tracking
- ✅ **Auditability:** Complete history of all pause/resume events
- ✅ **Reliability:** Handles network interruptions and page reloads

All APIs work together seamlessly through the `calculateTimeElapsed()` helper, ensuring consistent and accurate time tracking throughout the test lifecycle.
