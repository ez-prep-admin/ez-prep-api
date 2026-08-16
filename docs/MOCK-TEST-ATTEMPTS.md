# Mock test attempts — frontend contract

Student take-test APIs. Topic-wise papers and published full mocks share the same endpoints. Branch on `mockTestData.isSessionWise`.

Base: `/api/v1/mock-test-attempts`. All routes need a JWT. Attempts are owner-only.

---

## Which catalog to start from

| Paper | List / get | Start |
|---|---|---|
| Topic-wise | `GET /mock-tests` | `POST /mock-test-attempts/start` `{ mockTestId }` |
| Full exam | `GET /full-mock-tests` | Same start endpoint, `mockTestId` = published full mock `id` |

Do not start a draft. Drafts are not attemptable.

`userAttemptAction` on the catalog: `START` | `RESUME` | `RETAKE`. If `RESUME`, use `resumeAttemptId` with `GET .../resume` (do not call start).

---

## Start — `POST /start`

Creates an attempt. Returns **201**.

### Topic-wise / mixed full exam (`isSessionWise` is false)

- One timer: `mockTestData.durationInMinutes`
- Show **all** `questions`
- `sessions` and `currentSessionIndex` are **omitted**
- `sessionOrder` is omitted on topic-wise. Mixed full exams may still have `sessionOrder` when the paper has `subjectConfig` (subject blocks, still one timer)

### Session-wise full exam (`isSessionWise` is true)

- `questions` is the **full paper**, in **locked session order** (contiguous subject blocks)
- Each question has `sessionOrder` (same as `sessions[].order`)
- Each session has `questionIds`, `questionCount`, `durationInMinutes`, `status`
- Only session `0` starts as `IN_PROGRESS`; the rest are `LOCKED`
- Live timer is **`sessions[currentSessionIndex].durationInMinutes`**, not the paper `durationInMinutes` (that value is the sum)

**How to render the current session (do all three mentally; use 2 as source of truth):**

1. `const session = sessions.find(s => s.status === 'IN_PROGRESS') ?? sessions[currentSessionIndex]`
2. Visible questions = `questions.filter(q => q.sessionOrder === session.order)`  
   Confirm with `session.questionIds.includes(q._id)`
3. Optional splice: `questions` is already grouped, so you may `slice` using each session’s `questionCount` in order — still verify with `sessionOrder`

Do **not** group by live `question.subject`. Do **not** use `startIndex` / `endIndex` in the UI.

---

## Answer — `PATCH /:attemptId/answer`

Body: `{ questionId, selectedOptionId }`. **204**.

- Only `IN_PROGRESS` (not paused)
- Session-wise: `questionId` must be in the **current** session’s `questionIds`
- If the current session timer has expired: 400 — call complete-session, do not keep answering

---

## Pause — `POST /:attemptId/pause`

Session-wise: pauses the **current session** timer. Answers are kept. Cannot answer until resume.

---

## Resume — `GET /:attemptId/resume`

Not read-only. If the attempt is `PAUSED`, this **unpauses** it and resets the running clock (`startedAt = now`). Time already consumed stays in `timeConsumed` / session `timeConsumed`.

Use this for: page reload, reconnect, returning from pause, and after `userAttemptAction === RESUME`.

Response shape matches start, plus:

- `selectedOption` on answered questions
- `timeElapsed` / `timeRemaining` for the **current session** if session-wise
- Same `sessionOrder` / `sessions[].questionIds` as start

If the attempt is already `SUBMITTED` or `EXPIRED`, this returns 400 — use `GET /:id` for results.

---

## Complete session — `POST /:attemptId/sessions/complete`

**Session-wise only.** Mixed and topic-wise must use `POST /:attemptId/submit`.

Must be `IN_PROGRESS` (resume first if paused).

| Result | Meaning | What the UI does |
|---|---|---|
| `paperCompleted: false` | Current subject locked (`SUBMITTED` or `EXPIRED`). Next subject unlocked. | Read `nextSession` (resume-shaped). It still contains the **full** `questions` array. Filter again with the new `currentSessionIndex`. Start the new session timer from `nextSession.timeRemaining`. |
| `paperCompleted: true` | Last session done. Whole paper scored. | Show `results` (same as submit). Do not call submit again. |

Expiry of a mid-paper session does **not** open the next subject by itself. The client must call this endpoint.

Do not blindly retry complete-session on network timeout. `GET .../resume` first and check `currentSessionIndex` / `sessions[].status`. Completing twice in a row will complete **two** subjects if the first call already succeeded.

---

## Submit — `POST /:attemptId/submit`

Topic-wise, mixed full exam, or **last session only**.

If session-wise and not on the last session: 400 — use complete-session.

---

## Detail / results — `GET /:id`

Completed papers: score, pass/fail, keys only if `showResultsImmediately`.

In-progress: same grouping fields as resume (`isSessionWise`, `sessions`, `sessionOrder` on questions). Prefer resume for taking the test (resume unpauses).

---

## Status cheatsheet

Paper: `IN_PROGRESS` ⇄ `PAUSED` → `SUBMITTED` | `EXPIRED`

Session: `LOCKED` → `IN_PROGRESS` ⇄ `PAUSED` → `SUBMITTED` | `EXPIRED`

You cannot go back to an earlier session.
