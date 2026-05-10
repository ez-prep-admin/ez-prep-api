# Quick Reference Card - Pause/Resume APIs

## API Endpoints Quick Reference

### Base URL
```
http://localhost:3000/api/v1/mock-test-attempts
```

---

## 1. Start Test
```bash
POST /start

Headers:
  Authorization: Bearer <JWT_TOKEN>
  Content-Type: application/json

Body:
{
  "mockTestId": "67c5f4ee4d671dbf0cb95a10"
}

Response: 201 Created
{
  "message": "Mock test attempt started successfully",
  "data": {
    "attemptId": "6a009ed610e11f12cc6d094f",
    "mockTestData": {
      "title": "...",
      "startedAt": "2026-05-11T10:00:00.000Z",
      "durationInMinutes": 30,
      "totalQuestions": 30,
      "marksPerQuestion": 4,
      "negativeMarking": 1,
      "passingScore": 20,
      "exam": { "id": "...", "name": "...", "description": "..." },
      "subject": { "id": "...", "name": "...", "description": "..." },
      "topic": { "id": "...", "name": "..." }
    },
    "questions": [...]
  }
}

Notes:
- Initializes: startedAt, timeConsumed=0, status=IN_PROGRESS
- Returns questions WITHOUT correct answers
```

---

## 2. Update Answer
```bash
PATCH /:attemptId/answer

Headers:
  Authorization: Bearer <JWT_TOKEN>
  Content-Type: application/json

Body:
{
  "questionId": "67c5f4ee4d671dbf0cb95a12",
  "selectedOptionId": "fe99dedc-7c4b-445a-9c5f-03e5706bf184"
}

Response: 204 No Content

Notes:
- Only works when status = IN_PROGRESS
- Time check: calculateTimeElapsed() < allowedTime
- Cannot update answers while PAUSED
```

---

## 3. Pause Test ✨ NEW
```bash
POST /:attemptId/pause

Headers:
  Authorization: Bearer <JWT_TOKEN>
  Content-Type: application/json

Body: (empty)

Response: 200 OK
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

Notes:
- Adds 10-second grace period to timeConsumed
- Status changes: IN_PROGRESS → PAUSED
- Preserves all answers
- Cannot pause if already PAUSED or time expired
```

---

## 4. Resume Test
```bash
GET /:attemptId/resume

Headers:
  Authorization: Bearer <JWT_TOKEN>

Body: (none)

Response: 200 OK
{
  "attemptId": "6a009ed610e11f12cc6d094f",
  "test": {
    "title": "Daily Practice Test 1",
    "durationInMinutes": 30,
    "totalQuestions": 30,
    "startedAt": "2026-05-11T10:15:00.000Z",  // NEW timestamp
    "marksPerQuestion": 4,
    "negativeMarking": 1,
    "passingScore": 20
  },
  "questions": [...],  // With selectedOption preserved
  "timeElapsed": 450,
  "timeRemaining": 1350,
  "pauseCount": 1,
  "timeConsumed": 450
}

Notes:
- Works for both PAUSED and IN_PROGRESS status
- If PAUSED: resets startedAt, preserves timeConsumed
- Returns questions with user's answers, NO correct answers
- Use for page reload/reconnect scenarios
```

---

## 5. Submit Test
```bash
POST /:attemptId/submit

Headers:
  Authorization: Bearer <JWT_TOKEN>
  Content-Type: application/json

Body: (optional)
{
  "answers": [
    {
      "questionId": "67c5f4ee4d671dbf0cb95a12",
      "selectedOptionId": "fe99dedc-7c4b-445a-9c5f-03e5706bf184"
    }
  ]
}

Response: 200 OK
{
  "attemptId": "6a009ed610e11f12cc6d094f",
  "score": 96,
  "totalScore": 120,
  "passingScore": 20,
  "passed": true,
  "correctAnswers": 26,
  "incorrectAnswers": 2,
  "unansweredQuestions": 2,
  "submittedAt": "2026-05-11T10:30:00.000Z",
  "timeTaken": 1800,
  "questionResults": [...]  // If showResultsImmediately = true
}

Notes:
- Accepts answers within 10-second grace period
- Uses calculateTimeElapsed() for time check
- Evaluates all answers, applies negative marking
- Status changes: IN_PROGRESS → SUBMITTED/EXPIRED
```

---

## 6. View Results
```bash
GET /:id

Headers:
  Authorization: Bearer <JWT_TOKEN>

Response: 200 OK
{
  "attemptId": "...",
  "status": "SUBMITTED",
  "test": {...},
  "questions": [...],
  "score": 96,
  "correctAnswers": 26,
  "incorrectAnswers": 2,
  "unansweredQuestions": 2,
  "isPassed": true,
  "submittedAt": "..."
}

Notes:
- Works for any status
- If SUBMITTED: includes results
- If IN_PROGRESS/PAUSED: no correct answers shown
```

---

## Status Transitions

```
        START
          ↓
     IN_PROGRESS
       ↓     ↑
    PAUSE  RESUME
       ↓     ↑
      PAUSED
       
     IN_PROGRESS
          ↓
        SUBMIT
          ↓
    SUBMITTED/EXPIRED
```

---

## Time Calculation Formula

```typescript
// Single source of truth
calculateTimeElapsed(attempt):
  if (status === 'PAUSED'):
    return timeConsumed  // Frozen value
  else:
    return timeConsumed + (now - startedAt)
```

### Examples

**Never Paused:**
```
timeConsumed = 0
startedAt = T0
timeElapsed = 0 + (now - T0) = actual time
```

**After 1 Pause:**
```
timeConsumed = 450s (saved during pause)
startedAt = T1 (reset during resume)
timeElapsed = 450 + (now - T1) = accurate total
```

**During Pause:**
```
timeConsumed = 450s
status = PAUSED
timeElapsed = 450s (frozen)
```

---

## Error Codes

| Code | Scenario | Message |
|------|----------|---------|
| 400 | Invalid ID format | "Invalid attempt ID format" |
| 400 | Pause while PAUSED | "Cannot pause attempt with status PAUSED" |
| 400 | Answer while PAUSED | "Cannot update answers for attempt with status PAUSED" |
| 400 | Time expired | "Test has expired" |
| 400 | Resume completed test | "Cannot resume attempt with status SUBMITTED" |
| 401 | No auth token | "Authentication required" |
| 404 | Attempt not found | "Attempt not found or access denied" |
| 409 | Retake not allowed | "Retake not allowed" |

---

## Quick Test Commands

```bash
# Setup
export BASE_URL="http://localhost:3000/api/v1"
export TOKEN="your_jwt_token"
export MOCK_TEST_ID="test_id"
export ATTEMPT_ID="attempt_id"

# 1. Start
curl -X POST "$BASE_URL/mock-test-attempts/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"mockTestId\":\"$MOCK_TEST_ID\"}"

# 2. Answer
curl -X PATCH "$BASE_URL/mock-test-attempts/$ATTEMPT_ID/answer" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"questionId\":\"...\",\"selectedOptionId\":\"...\"}"

# 3. Pause
curl -X POST "$BASE_URL/mock-test-attempts/$ATTEMPT_ID/pause" \
  -H "Authorization: Bearer $TOKEN"

# 4. Resume
curl -X GET "$BASE_URL/mock-test-attempts/$ATTEMPT_ID/resume" \
  -H "Authorization: Bearer $TOKEN"

# 5. Submit
curl -X POST "$BASE_URL/mock-test-attempts/$ATTEMPT_ID/submit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"answers\":[]}"

# 6. View
curl -X GET "$BASE_URL/mock-test-attempts/$ATTEMPT_ID" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Grace Period Rules

### Pause (10s added)
```
timeConsumed = previousTime + currentSession + 10
```

**Purpose:** Prevent penalization for clicking pause at last second

### Submit (10s tolerance)
```
if (timeElapsed - allowedTime ≤ 10):
  Accept answers
else:
  Reject new answers, evaluate existing only
```

**Purpose:** Network delay tolerance

---

## Database Fields

```typescript
{
  _id: ObjectId,
  user: ObjectId,
  test: ObjectId,
  status: 'IN_PROGRESS' | 'PAUSED' | 'SUBMITTED' | 'EXPIRED',
  startedAt: Date,          // Current session start (resets on resume)
  timeConsumed: number,     // Accumulated time in seconds
  pausedAt: Date,           // When last paused
  submittedAt: Date,        // When submitted
  pauseResumeHistory: [     // Audit trail
    {
      action: 'PAUSE' | 'RESUME',
      timestamp: Date,
      timeConsumedAtPause: number
    }
  ],
  questions: [...],
  score: number,
  // ... other fields
}
```

---

## Frontend Timer Implementation

```typescript
class TestTimer {
  private startedAt: Date;
  private timeConsumed: number;
  private duration: number;

  constructor(startedAt: Date, timeConsumed: number, duration: number) {
    this.startedAt = startedAt;
    this.timeConsumed = timeConsumed;
    this.duration = duration;
  }

  getTimeRemaining(): number {
    const currentSession = (Date.now() - this.startedAt.getTime()) / 1000;
    const totalElapsed = this.timeConsumed + currentSession;
    return Math.max(0, (this.duration * 60) - totalElapsed);
  }

  onResume(newStartedAt: Date, timeConsumed: number) {
    this.startedAt = newStartedAt;
    this.timeConsumed = timeConsumed;
  }
}

// Usage
const timer = new TestTimer(
  new Date(response.mockTestData.startedAt),
  0,
  response.mockTestData.durationInMinutes
);

// After resume
timer.onResume(
  new Date(resumeResponse.test.startedAt),
  resumeResponse.timeConsumed
);
```

---

## Common Scenarios

### 1. Normal Test (No Pause)
```
START → ANSWER → ANSWER → SUBMIT
Time: 0 + (submit_time - start_time)
```

### 2. Test with Pause
```
START → ANSWER → PAUSE → (break) → RESUME → ANSWER → SUBMIT
Time: timeConsumed + (submit_time - resume_time)
```

### 3. Multiple Pauses
```
START → PAUSE → RESUME → PAUSE → RESUME → SUBMIT
Time: accumulated across all active sessions
```

### 4. Page Reload
```
... → (reload) → RESUME → ...
State restored, timer continues accurately
```

### 5. Network Loss
```
... → (disconnect) → (reconnect) → RESUME → ...
All progress preserved, time accurate
```

---

## Security Notes

✅ All time calculations server-side  
✅ Client cannot manipulate time  
✅ Grace periods prevent abuse  
✅ Status transitions validated  
✅ User ownership verified  
✅ Correct answers hidden until submit  
✅ Server clock used, ignores client time  

---

## Performance Tips

- Use compound indexes: `{ user: 1, status: 1 }`
- History array grows slowly (~10 events typical)
- Single query per operation
- No joins needed for time calculation

---

## Monitoring Queries

**Find paused attempts:**
```javascript
db.mocktestattepts.find({ status: 'PAUSED' })
```

**Average pause count:**
```javascript
db.mocktestattepts.aggregate([
  {
    $project: {
      pauseCount: {
        $size: {
          $filter: {
            input: '$pauseResumeHistory',
            cond: { $eq: ['$$this.action', 'PAUSE'] }
          }
        }
      }
    }
  },
  { $group: { _id: null, avg: { $avg: '$pauseCount' } } }
])
```

---

## Troubleshooting

**Problem:** "Cannot pause attempt with status PAUSED"  
**Solution:** User already paused, call resume first

**Problem:** "Cannot update answers for attempt with status PAUSED"  
**Solution:** Call resume to change status to IN_PROGRESS

**Problem:** Time shows incorrectly after resume  
**Solution:** Use new `startedAt` from resume response

**Problem:** Test auto-expires during pause  
**Solution:** Paused attempts don't auto-expire, this is correct behavior

---

## Need Help?

- Full documentation: `docs/PAUSE_RESUME_API.md`
- Architecture analysis: `docs/ARCHITECTURE_ANALYSIS.md`
- Testing script: `docs/TESTING_SCRIPT.md`
- API endpoints: See controller documentation
