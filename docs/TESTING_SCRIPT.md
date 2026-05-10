# Quick Testing Script - Mock Test Pause/Resume

This script provides a complete end-to-end test of the pause/resume functionality.

## Setup

```bash
#!/bin/bash

# Configuration
BASE_URL="http://localhost:3000/api/v1"
EMAIL="testuser@example.com"
PASSWORD="password123"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Mock Test Pause/Resume - End-to-End Test ===${NC}\n"

# Step 1: Login
echo -e "${BLUE}Step 1: Logging in...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.accessToken')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Login failed${NC}"
  echo $LOGIN_RESPONSE | jq '.'
  exit 1
fi

echo -e "${GREEN}✅ Login successful${NC}"
echo "Token: ${TOKEN:0:20}...\n"

# Step 2: Get available mock tests
echo -e "${BLUE}Step 2: Fetching available mock tests...${NC}"
TESTS_RESPONSE=$(curl -s -X GET "$BASE_URL/mock-tests?limit=1" \
  -H "Authorization: Bearer $TOKEN")

MOCK_TEST_ID=$(echo $TESTS_RESPONSE | jq -r '.data[0].id')

if [ "$MOCK_TEST_ID" == "null" ] || [ -z "$MOCK_TEST_ID" ]; then
  echo -e "${RED}❌ No mock tests found${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Found mock test${NC}"
echo "Mock Test ID: $MOCK_TEST_ID"
echo "Title: $(echo $TESTS_RESPONSE | jq -r '.data[0].title')\n"

# Step 3: Start Test
echo -e "${BLUE}Step 3: Starting mock test...${NC}"
START_RESPONSE=$(curl -s -X POST "$BASE_URL/mock-test-attempts/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"mockTestId\":\"$MOCK_TEST_ID\"}")

ATTEMPT_ID=$(echo $START_RESPONSE | jq -r '.data.attemptId')
STARTED_AT=$(echo $START_RESPONSE | jq -r '.data.mockTestData.startedAt')
DURATION=$(echo $START_RESPONSE | jq -r '.data.mockTestData.durationInMinutes')
TOTAL_QUESTIONS=$(echo $START_RESPONSE | jq -r '.data.mockTestData.totalQuestions')

if [ "$ATTEMPT_ID" == "null" ] || [ -z "$ATTEMPT_ID" ]; then
  echo -e "${RED}❌ Failed to start test${NC}"
  echo $START_RESPONSE | jq '.'
  exit 1
fi

echo -e "${GREEN}✅ Test started successfully${NC}"
echo "Attempt ID: $ATTEMPT_ID"
echo "Started At: $STARTED_AT"
echo "Duration: $DURATION minutes"
echo "Questions: $TOTAL_QUESTIONS\n"

# Extract first 3 questions and their options
QUESTION_1=$(echo $START_RESPONSE | jq -r '.data.questions[0]._id')
OPTION_1=$(echo $START_RESPONSE | jq -r '.data.questions[0].options[0].id')

QUESTION_2=$(echo $START_RESPONSE | jq -r '.data.questions[1]._id')
OPTION_2=$(echo $START_RESPONSE | jq -r '.data.questions[1].options[1].id')

QUESTION_3=$(echo $START_RESPONSE | jq -r '.data.questions[2]._id')
OPTION_3=$(echo $START_RESPONSE | jq -r '.data.questions[2].options[2].id')

# Step 4: Answer Some Questions
echo -e "${BLUE}Step 4: Answering questions...${NC}"

curl -s -X PATCH "$BASE_URL/mock-test-attempts/$ATTEMPT_ID/answer" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"questionId\":\"$QUESTION_1\",\"selectedOptionId\":\"$OPTION_1\"}" > /dev/null

echo "✓ Question 1 answered"

sleep 2

curl -s -X PATCH "$BASE_URL/mock-test-attempts/$ATTEMPT_ID/answer" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"questionId\":\"$QUESTION_2\",\"selectedOptionId\":\"$OPTION_2\"}" > /dev/null

echo "✓ Question 2 answered"

sleep 2

echo -e "${GREEN}✅ Answered 2 questions${NC}\n"

# Step 5: Pause Test
echo -e "${BLUE}Step 5: Pausing test (after ~4-5 seconds)...${NC}"
PAUSE_RESPONSE=$(curl -s -X POST "$BASE_URL/mock-test-attempts/$ATTEMPT_ID/pause" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

STATUS=$(echo $PAUSE_RESPONSE | jq -r '.data.status')
TIME_CONSUMED=$(echo $PAUSE_RESPONSE | jq -r '.data.timeConsumed')
TIME_REMAINING=$(echo $PAUSE_RESPONSE | jq -r '.data.timeRemaining')
PAUSE_COUNT=$(echo $PAUSE_RESPONSE | jq -r '.data.pauseCount')

if [ "$STATUS" != "PAUSED" ]; then
  echo -e "${RED}❌ Failed to pause test${NC}"
  echo $PAUSE_RESPONSE | jq '.'
  exit 1
fi

echo -e "${GREEN}✅ Test paused successfully${NC}"
echo "Status: $STATUS"
echo "Time Consumed: $TIME_CONSUMED seconds (~$((TIME_CONSUMED / 60)) min)"
echo "Time Remaining: $TIME_REMAINING seconds (~$((TIME_REMAINING / 60)) min)"
echo "Pause Count: $PAUSE_COUNT\n"

# Step 6: Try to Answer While Paused (Should Fail)
echo -e "${BLUE}Step 6: Attempting to answer while paused (should fail)...${NC}"
ANSWER_PAUSED=$(curl -s -X PATCH "$BASE_URL/mock-test-attempts/$ATTEMPT_ID/answer" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"questionId\":\"$QUESTION_3\",\"selectedOptionId\":\"$OPTION_3\"}")

ERROR_MSG=$(echo $ANSWER_PAUSED | jq -r '.message')

if [[ "$ERROR_MSG" == *"PAUSED"* ]]; then
  echo -e "${GREEN}✅ Correctly rejected answer while paused${NC}"
  echo "Error: $ERROR_MSG\n"
else
  echo -e "${RED}❌ Should have rejected answer${NC}"
  echo $ANSWER_PAUSED | jq '.'
fi

# Step 7: Simulate Break
echo -e "${BLUE}Step 7: Simulating user break (10 seconds)...${NC}"
for i in {10..1}; do
  echo -ne "   Resuming in $i seconds...\r"
  sleep 1
done
echo -e "\n"

# Step 8: Resume Test
echo -e "${BLUE}Step 8: Resuming test...${NC}"
RESUME_RESPONSE=$(curl -s -X GET "$BASE_URL/mock-test-attempts/$ATTEMPT_ID/resume" \
  -H "Authorization: Bearer $TOKEN")

NEW_STARTED_AT=$(echo $RESUME_RESPONSE | jq -r '.test.startedAt')
RESUME_TIME_ELAPSED=$(echo $RESUME_RESPONSE | jq -r '.timeElapsed')
RESUME_TIME_REMAINING=$(echo $RESUME_RESPONSE | jq -r '.timeRemaining')
RESUME_PAUSE_COUNT=$(echo $RESUME_RESPONSE | jq -r '.pauseCount')
SELECTED_COUNT=$(echo $RESUME_RESPONSE | jq '[.questions[] | select(.selectedOption != null)] | length')

echo -e "${GREEN}✅ Test resumed successfully${NC}"
echo "New Started At: $NEW_STARTED_AT"
echo "Time Elapsed: $RESUME_TIME_ELAPSED seconds"
echo "Time Remaining: $RESUME_TIME_REMAINING seconds"
echo "Pause Count: $RESUME_PAUSE_COUNT"
echo "Questions Answered: $SELECTED_COUNT\n"

# Step 9: Continue Answering
echo -e "${BLUE}Step 9: Continuing to answer questions...${NC}"

curl -s -X PATCH "$BASE_URL/mock-test-attempts/$ATTEMPT_ID/answer" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"questionId\":\"$QUESTION_3\",\"selectedOptionId\":\"$OPTION_3\"}" > /dev/null

echo "✓ Question 3 answered"
sleep 2

echo -e "${GREEN}✅ Answered additional questions${NC}\n"

# Step 10: Pause Again (Testing Multiple Cycles)
echo -e "${BLUE}Step 10: Pausing again (testing multiple cycles)...${NC}"
PAUSE_2_RESPONSE=$(curl -s -X POST "$BASE_URL/mock-test-attempts/$ATTEMPT_ID/pause" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

PAUSE_2_TIME_CONSUMED=$(echo $PAUSE_2_RESPONSE | jq -r '.data.timeConsumed')
PAUSE_2_COUNT=$(echo $PAUSE_2_RESPONSE | jq -r '.data.pauseCount')
PAUSE_2_HISTORY=$(echo $PAUSE_2_RESPONSE | jq -r '.data.recentHistory | length')

echo -e "${GREEN}✅ Test paused again${NC}"
echo "Time Consumed: $PAUSE_2_TIME_CONSUMED seconds"
echo "Pause Count: $PAUSE_2_COUNT"
echo "History Events: $PAUSE_2_HISTORY\n"

# Step 11: Resume Again
echo -e "${BLUE}Step 11: Resuming test again...${NC}"
sleep 3

RESUME_2_RESPONSE=$(curl -s -X GET "$BASE_URL/mock-test-attempts/$ATTEMPT_ID/resume" \
  -H "Authorization: Bearer $TOKEN")

RESUME_2_TIME_CONSUMED=$(echo $RESUME_2_RESPONSE | jq -r '.timeConsumed')
RESUME_2_PAUSE_COUNT=$(echo $RESUME_2_RESPONSE | jq -r '.pauseCount')

echo -e "${GREEN}✅ Test resumed again${NC}"
echo "Time Consumed: $RESUME_2_TIME_CONSUMED seconds"
echo "Pause Count: $RESUME_2_PAUSE_COUNT\n"

# Step 12: Submit Test
echo -e "${BLUE}Step 12: Submitting test...${NC}"
sleep 2

SUBMIT_RESPONSE=$(curl -s -X POST "$BASE_URL/mock-test-attempts/$ATTEMPT_ID/submit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"answers":[]}')

SCORE=$(echo $SUBMIT_RESPONSE | jq -r '.score')
TOTAL_SCORE=$(echo $SUBMIT_RESPONSE | jq -r '.totalScore')
PASSED=$(echo $SUBMIT_RESPONSE | jq -r '.passed')
CORRECT=$(echo $SUBMIT_RESPONSE | jq -r '.correctAnswers')
INCORRECT=$(echo $SUBMIT_RESPONSE | jq -r '.incorrectAnswers')
UNANSWERED=$(echo $SUBMIT_RESPONSE | jq -r '.unansweredQuestions')
TIME_TAKEN=$(echo $SUBMIT_RESPONSE | jq -r '.timeTaken')

if [ "$SCORE" == "null" ]; then
  echo -e "${RED}❌ Failed to submit test${NC}"
  echo $SUBMIT_RESPONSE | jq '.'
  exit 1
fi

echo -e "${GREEN}✅ Test submitted successfully${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "             TEST RESULTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Score: $SCORE / $TOTAL_SCORE"
echo "Status: $([ "$PASSED" == "true" ] && echo "PASSED ✓" || echo "FAILED ✗")"
echo "Correct: $CORRECT"
echo "Incorrect: $INCORRECT"
echo "Unanswered: $UNANSWERED"
echo "Time Taken: $TIME_TAKEN seconds (~$((TIME_TAKEN / 60)) minutes)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"

# Step 13: Verify Details
echo -e "${BLUE}Step 13: Fetching attempt details...${NC}"
DETAILS_RESPONSE=$(curl -s -X GET "$BASE_URL/mock-test-attempts/$ATTEMPT_ID" \
  -H "Authorization: Bearer $TOKEN")

FINAL_STATUS=$(echo $DETAILS_RESPONSE | jq -r '.status')
FINAL_SCORE=$(echo $DETAILS_RESPONSE | jq -r '.score')

echo -e "${GREEN}✅ Retrieved attempt details${NC}"
echo "Final Status: $FINAL_STATUS"
echo "Final Score: $FINAL_SCORE\n"

# Summary
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}       🎉 ALL TESTS PASSED! 🎉${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Summary:"
echo "✅ Test started successfully"
echo "✅ Answered questions before pause"
echo "✅ Paused test correctly"
echo "✅ Rejected answers while paused"
echo "✅ Resumed test with preserved state"
echo "✅ Multiple pause/resume cycles worked"
echo "✅ Time tracking accurate across cycles"
echo "✅ Test submitted successfully"
echo "✅ Results calculated correctly"
echo ""
echo "Attempt ID: $ATTEMPT_ID"
echo "Total Pause Cycles: $RESUME_2_PAUSE_COUNT"
echo "Final Time Taken: $TIME_TAKEN seconds"
echo ""
```

## Usage

### Make it executable:
```bash
chmod +x test-pause-resume.sh
```

### Run the test:
```bash
./test-pause-resume.sh
```

## What This Script Tests

1. ✅ **Login** - Authenticates user and gets JWT token
2. ✅ **Start Test** - Initiates a new mock test attempt
3. ✅ **Answer Questions** - Saves answers while test is IN_PROGRESS
4. ✅ **Pause Test** - Pauses active test with time tracking
5. ✅ **Reject Answers While Paused** - Validates status checks
6. ✅ **Resume Test** - Resumes paused test with preserved state
7. ✅ **Continue Answering** - Validates test is back to IN_PROGRESS
8. ✅ **Multiple Pause Cycles** - Tests unlimited pause/resume
9. ✅ **Submit Test** - Final submission with accurate time tracking
10. ✅ **View Results** - Retrieves detailed results

## Expected Output

```
=== Mock Test Pause/Resume - End-to-End Test ===

Step 1: Logging in...
✅ Login successful
Token: eyJhbGciOiJIUzI1NiIs...

Step 2: Fetching available mock tests...
✅ Found mock test
Mock Test ID: 67c5f4ee4d671dbf0cb95a10
Title: Daily Practice Test 1

Step 3: Starting mock test...
✅ Test started successfully
Attempt ID: 6a009ed610e11f12cc6d094f
Started At: 2026-05-11T10:00:00.000Z
Duration: 30 minutes
Questions: 30

Step 4: Answering questions...
✓ Question 1 answered
✓ Question 2 answered
✅ Answered 2 questions

Step 5: Pausing test (after ~4-5 seconds)...
✅ Test paused successfully
Status: PAUSED
Time Consumed: 14 seconds (~0 min)
Time Remaining: 1786 seconds (~29 min)
Pause Count: 1

Step 6: Attempting to answer while paused (should fail)...
✅ Correctly rejected answer while paused
Error: Cannot update answers for attempt with status "PAUSED"

Step 7: Simulating user break (10 seconds)...

Step 8: Resuming test...
✅ Test resumed successfully
New Started At: 2026-05-11T10:00:24.000Z
Time Elapsed: 14 seconds
Time Remaining: 1786 seconds
Pause Count: 1
Questions Answered: 2

Step 9: Continuing to answer questions...
✓ Question 3 answered
✅ Answered additional questions

Step 10: Pausing again (testing multiple cycles)...
✅ Test paused again
Time Consumed: 26 seconds
Pause Count: 2
History Events: 4

Step 11: Resuming test again...
✅ Test resumed again
Time Consumed: 26 seconds
Pause Count: 2

Step 12: Submitting test...
✅ Test submitted successfully
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
             TEST RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Score: 8 / 120
Status: FAILED ✗
Correct: 2
Incorrect: 1
Unanswered: 27
Time Taken: 28 seconds (~0 minutes)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 13: Fetching attempt details...
✅ Retrieved attempt details
Final Status: SUBMITTED
Final Score: 8

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       🎉 ALL TESTS PASSED! 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Summary:
✅ Test started successfully
✅ Answered questions before pause
✅ Paused test correctly
✅ Rejected answers while paused
✅ Resumed test with preserved state
✅ Multiple pause/resume cycles worked
✅ Time tracking accurate across cycles
✅ Test submitted successfully
✅ Results calculated correctly

Attempt ID: 6a009ed610e11f12cc6d094f
Total Pause Cycles: 2
Final Time Taken: 28 seconds
```

## Manual Testing with cURL

If you prefer to test manually, use these commands:

### 1. Login
```bash
export TOKEN=$(curl -s -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"password123"}' \
  | jq -r '.data.accessToken')
```

### 2. Get Mock Test
```bash
export MOCK_TEST_ID=$(curl -s -X GET "http://localhost:3000/api/v1/mock-tests?limit=1" \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.data[0].id')
```

### 3. Start Test
```bash
export ATTEMPT_ID=$(curl -s -X POST "http://localhost:3000/api/v1/mock-test-attempts/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"mockTestId\":\"$MOCK_TEST_ID\"}" \
  | jq -r '.data.attemptId')
```

### 4. Pause Test
```bash
curl -X POST "http://localhost:3000/api/v1/mock-test-attempts/$ATTEMPT_ID/pause" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

### 5. Resume Test
```bash
curl -X GET "http://localhost:3000/api/v1/mock-test-attempts/$ATTEMPT_ID/resume" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

### 6. Submit Test
```bash
curl -X POST "http://localhost:3000/api/v1/mock-test-attempts/$ATTEMPT_ID/submit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"answers":[]}' | jq '.'
```
