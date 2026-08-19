# Full Mock Tests

This document is the implementation contract for **exam-blueprint full mock tests**. Follow it; do not drift.

A full mock is a paper printed from an **Exam blueprint**, not from a single subject/topic. Admins generate a reviewable draft, optionally replace questions, then publish into the existing `mocktests` collection as `paperType: 'FULL_EXAM'`. Students take the paper through the existing mock-test-attempts engine.

Topic-wise papers (`paperType: 'TOPIC_WISE'`, the default) are unchanged and must never appear in full-mock APIs, and vice versa.

---

## Source of truth

The chosen **Exam** document. Generation must not invent counts, marks, or timers.

| Exam field | How it is used |
|---|---|
| `totalQuestions` | Paper size. Must equal `sum(subjects[].numberOfQuestions)`. |
| `duration` | Mixed papers: the single paper timer (`durationInMinutes` on the mock test). |
| `totalMarks` | When set, must equal `sum(numberOfQuestions * marksPerQuestion)`. Stored on the published paper. |
| `isSessionWise` | `false` = Mixed (one timer). `true` = Session-wise (one timer per subject). |
| `subjects[]` | Ordered blocks. Each row: quota, marks, negative marking, optional `sessionTime`. |

Question order is **subject blocks in `exam.subjects[]` order**. Never interleave subjects. Option shuffle, if enabled, is within a block only.

The exam has **no per-topic quotas**. Topic split inside a subject is algorithm-only — see `docs/FULL-MOCK-SELECTION.md`.

---

## Isolation

Same collection (`mocktests`), different query filters. Never share list endpoints.

| `paperType` | Meaning | Written by |
|---|---|---|
| `TOPIC_WISE` (default) | Existing subject/topic papers (10–30 Q) | Admin authoring app |
| `FULL_EXAM` | Exam-blueprint papers | This API (`POST .../drafts/:id/publish`) |

Documents with no `paperType` are treated as `TOPIC_WISE`.

**Firewall:** every query in `MockTestsService` and the exam `testsCount` aggregation must include `paperType: { $ne: 'FULL_EXAM' }`. Full-mock lists live only under `/full-mock-tests`.

Attempts load by attempt id + owner. They do not filter on `paperType`. Session / per-question marks activate from the frozen snapshot (`isSessionWise`, `subjectConfig`, per-question marks).

---

## Schema deltas

### `MockTest` (`mocktests`)

- `paperType`: `'TOPIC_WISE' | 'FULL_EXAM'`, default `'TOPIC_WISE'`.
- `totalQuestions` / `durationInMinutes`: no 10–30 mongoose enum (FULL papers are 80–200 Q / 60–180 min). Topic-wise writers still send 10–30.
- `subject` / `topic`: required only for `TOPIC_WISE`. Full papers omit them.
- `subjectConfig[]` (FULL only): copy of exam subject rows + names + contiguous `questionStartIndex` / `questionEndIndex` **and** `questionIds` for that block.
- `isSessionWise` (FULL only).
- `totalMarks` (FULL only).
- `marksPerQuestion` / `negativeMarking`: display fallback (first subject). Scoring for FULL uses per-question marks on the attempt.
- Index: `{ paperType: 1, exam: 1, isActive: 1, isDeleted: 1 }`.

### `FullMockTestDraft` (`fullmocktestdrafts`)

- `exam`, `createdBy`, `status`: `GENERATING | REVIEW | PUBLISHED | DISCARDED`
- Frozen exam snapshot (name, duration, totals, `isSessionWise`, subject rows)
- `questions[]`: `{ question, subject, topic, difficultyLevel, position, marksPerQuestion, negativeMarking, replacedFrom? }`
- `publishedMockTestId` after publish

Do **not** write `mocktests` until publish. Increment question usage **only on publish**.

### `Question`

- `fullMockUsageCount` (default 0)
- `lastUsedInFullMockAt`
- Topic-wise sampling does not read or write these fields.

### `MockTestAttempt` / `AttemptQuestion`

- `AttemptQuestion.marksPerQuestion` / `negativeMarking` — copied from `subjectConfig` at start for FULL papers. Scoring uses these when present.
- `AttemptQuestion.sessionOrder` — set when the paper has `subjectConfig` (subject-block index). Topic-wise omits it.
- `isSessionWise`, `sessions[]` (`questionIds`, indexes, timer), `currentSessionIndex` — set for session-wise FULL papers only.

---

## API map

Base path: `/api/v1`.

### Admin (`JwtAuthGuard` + `RolesGuard` + `ADMIN`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/full-mock-tests/exams` | Exam picker list (name, duration, questions, marks, category, group, subject names, mode). |
| POST | `/full-mock-tests/drafts` | `{ examId }` → validate blueprint, sample, persist draft, return grouped paper. |
| GET | `/full-mock-tests/drafts/:id` | Review payload; keys hidden. |
| GET | `/full-mock-tests/questions` | Replace-picker search (`subjectId` required unless `allowCrossSubject`; with `draftId`, only that exam’s questions). |
| PATCH | `/full-mock-tests/drafts/:id/questions/:position` | Replace slot; new question must match slot **subject** unless `allowCrossSubject`, and be tagged to the draft **exam**. Slot subject/marks/session stay. |
| POST | `/full-mock-tests/drafts/:id/publish` | Write `FULL_EXAM` mock test; increment usage. |
| DELETE | `/full-mock-tests/drafts/:id` | Discard. |

### Student (`JwtAuthGuard`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/full-mock-tests?examId=` | Published FULL papers for that exam + `userAttemptAction`. |
| GET | `/full-mock-tests/:id` | One FULL paper (404 if topic-wise). |

Taking the test: existing `/mock-test-attempts` (`start`, `answer`, `pause`, `resume`, `submit`). Session-wise adds `POST /mock-test-attempts/:id/sessions/complete`.

Frontend contract for those APIs: `docs/MOCK-TEST-ATTEMPTS.md`.

---

## Publish pipeline

1. Draft status must be `REVIEW`.
2. Reject if any question id appears more than once (`DUPLICATE_QUESTION`, with positions). Reject if slot count ≠ `examSnapshot.totalQuestions` (`PAPER_INCOMPLETE`).
3. **Regroup** draft questions into contiguous exam-subject blocks and rewrite positions `0..n-1`.
4. Create `MockTest` with `paperType: 'FULL_EXAM'`, `exam`, `questionIds` in that grouped order, `subjectConfig` (indexes **and** `questionIds` per row), `isSessionWise`, `totalQuestions`, `durationInMinutes` (mixed: exam.duration; session-wise: sum of sessionTimes), `totalMarks`, title/flags from body.
5. Increment `fullMockUsageCount` and set `lastUsedInFullMockAt` on every question id.
6. Set draft `status: PUBLISHED`, `publishedMockTestId`.

---

## Session semantics (attempts)

**Mixed** (`isSessionWise === false`): one timer = `exam.duration`. Existing start/answer/pause/resume/submit. Questions are grouped by subject in `questionIds`. Start/resume may include `sessionOrder` (subject-block index) when `subjectConfig` is present. No `sessions[]`, no complete-session.

**Session-wise** (`isSessionWise === true`):

- One session per `subjectConfig` row; timer = that row’s `sessionTime`.
- Start/resume/detail return the **full** `questions` array in locked session order, each with `sessionOrder`.
- `sessions[]` includes frozen `questionIds` and `questionCount`. Only the current session is answerable.
- Pause/expiry uses the **current session** timer, not the whole paper.
- `POST .../sessions/complete` locks the current session and opens the next. Last session = final submit (`paperCompleted: true`, `results`).
- Session timer expiry auto-completes **that session only**; does not auto-start the next. Client must call complete-session.
- Final `submit` is allowed on the last session only.

Topic-wise attempts: no sessions, no `sessionOrder`, attempt-level marks.

See `docs/MOCK-TEST-ATTEMPTS.md` for the student-app flow.

---

## Student UI impact

- New list call: `GET /full-mock-tests` (optional `?examId=` to filter by exam).
- Mixed full mocks: existing take-test player (grouped questions, one timer). Prefer `sessionOrder` / catalog `subjectConfig` for grouping; do not use Mongo return order.
- Session-wise: honour `isSessionWise`, filter questions by `sessionOrder` / `sessions[].questionIds`, use the **session** timer, call complete-session before the next subject. Full player rules: `docs/MOCK-TEST-ATTEMPTS.md`.
