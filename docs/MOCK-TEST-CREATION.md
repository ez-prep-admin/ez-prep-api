# Mock Test Creation Module

This document describes how mock tests are created, stored, listed, viewed, updated, and deleted in the **admin app**. It is based on the current code — not an intended future design.

Mock tests are **admin-authored, frozen question sets**. An admin picks an exam, a subject, optionally a topic, a size, a duration, and a difficulty mix. The server then randomly samples matching questions from the question bank and **locks those IDs onto the test**. Students later take that exact paper. The admin app does not run the student attempt flow.

---

## 1. What a mock test is (mental model)

A mock test is **not** a live query against the question bank at attempt time.

It is a **document** that stores:

1. **Scope** — which exam it is associated with, which subject it covers, and optionally which topic.
2. **Size and time** — how many questions and how many minutes.
3. **Difficulty mix** — how many easy / medium / hard questions were requested.
4. **Frozen paper** — an ordered list of `questionIds` sampled at creation time.
5. **Scoring / behaviour flags** — marks, negative marking, retakes, option shuffle, when to show results.
6. **Lifecycle flags** — active vs deleted.

The important implication: **changing the question bank after creation does not change an existing mock test's paper**, unless an admin later updates the test in a way that triggers re-sampling (see [Update](#8-update-put-apimock-testid)). If a sampled question is later soft-deleted, its ID still sits on the mock test; this module does not refresh or prune that list.

Generation is **STATIC**. `DYNAMIC` exists as a schema enum value but is not implemented.

---

## 2. Where the module lives

| Layer | Path | Role |
|---|---|---|
| Data model | `models/MockTest.js` | Schema |
| Create API | `POST /api/mock-test` → `app/api/mock-test/route.js` | Validate, sample questions, persist |
| List API | `GET /api/mock-test/list` → `app/api/mock-test/list/route.js` | Paginated list |
| Detail / update / delete | `app/api/mock-test/[id]/route.js` | `GET`, `PUT`, `DELETE` |
| Admin create + list UI | `/admin/mock-tests` → `app/admin/mock-tests/page.tsx` | Form + table |
| Admin detail UI | `/admin/mock-tests/[id]` → `app/admin/mock-tests/[id]/page.tsx` | Read-only view |
| Nav entry | `app/admin/layout.tsx` | Sidebar "Mock Tests" |

Related content the module depends on:

| Entity | Model | Used for |
|---|---|---|
| Question | `models/Question.js` | Pool to sample from |
| Subject | `models/Subject.js` | Required scope |
| Topic | `models/Topic.js` | Optional narrower scope |
| Exam | `models/Exam.js` | Required association (label, not a question filter) |
| User | `models/User.js` | Optional `createdBy` (UI never sets it) |

There is **no auth middleware** on these APIs. The `/auth` page is a stub that redirects to `/admin`. Anyone who can hit the admin origin can call the mock-test endpoints.

---

## 3. Domain taxonomy the mock test sits in

Content is modelled independently of mock tests, then composed at creation time.

```
Category
  └── ExamGroup
        └── Exam
              └── subjects[]   (exam blueprint: counts, marks, session time)
                    └── Subject
                          └── topics[]  (ObjectIds pointing at Topic)
                                └── Topic
                                      └── Tag (subject + topic)
                                            └── Question (subject, topic, exams[], tag, difficultyLevel)
```

**Mock test is a separate product on top of this**, not an instance of `Exam`.

- An **Exam** is a blueprint (duration, total marks, per-subject question counts, session-wise vs mixed, multilingual flag).
- A **Mock test** is a **single-subject practice paper** that *references* an exam, then samples questions by **subject** (and optionally **topic**), not by the exam's subject blueprint.

That split is the source of several nuances in [§12](#12-relationship-to-exam-and-the-question-bank).

---

## 4. Data model (`MockTest`)

Collection: `mocktests` (Mongoose default pluralization of `MockTest`). Timestamps: `createdAt`, `updatedAt`.

### 4.1 Core configuration

| Field | Type | Required | Constraints | Default | Meaning |
|---|---|---|---|---|---|
| `totalQuestions` | Number | Yes | Enum: `10, 15, 20, 25, 30` | — | Target paper size. Must equal the difficulty mix sum. |
| `durationInMinutes` | Number | Yes | Enum: `10, 15, 20, 25, 30` | — | Timer length. **Independent of** question count (a 30-question test can be 10 minutes). |
| `exam` | ObjectId → Exam | Yes | — | — | Which exam this paper is filed under. **Not used when sampling questions.** |
| `subject` | ObjectId → Subject | Yes | — | — | Question filter. One subject only. |
| `topic` | ObjectId → Topic | No | — | unset / `null` | If set, questions must also match this topic. If omitted, any topic (or no topic) under the subject. |
| `title` | String | No | trimmed | `null` on create if empty | Display name. List/detail show `"-"` / `"N/A"` when missing. |
| `description` | String | No | trimmed | `null` on create if empty | Free text. |

### 4.2 Generation and frozen paper

| Field | Type | Required | Constraints | Default | Meaning |
|---|---|---|---|---|---|
| `generationMode` | String | No | `"STATIC"` \| `"DYNAMIC"` | `"STATIC"` | STATIC = sample once, store IDs. DYNAMIC is unused. |
| `questionIds` | ObjectId[] → Question | No at schema level | Filled by create/update sampling | `[]` | The frozen paper. Order is easy batch, then medium, then hard (see sampling). |
| `difficultyDistribution` | `{ easy, medium, hard }` | Required by create API | Each a Number, default `0` | `{0,0,0}` | How many questions were requested per difficulty. Sum **must** equal `totalQuestions`. |

### 4.3 Evaluation / student-facing behaviour

These are **stored here and never interpreted by the admin app**. They exist for the student product.

| Field | Type | Default | Meaning |
|---|---|---|---|
| `marksPerQuestion` | Number | `1` | Positive marks for a correct answer. |
| `negativeMarking` | Number | `0` | Deduction for a wrong answer (e.g. `0.25`). |
| `passingScore` | Number | unset / `null` | Absolute score, not a percentage. Optional. |
| `allowRetake` | Boolean | `true` | Whether a student may attempt again. |
| `shuffleOptions` | Boolean | `false` | Whether to shuffle A/B/C/D at attempt time. |
| `showResultsImmediately` | Boolean | `true` | Whether to show the result as soon as the test ends. |

UI defaults match the schema defaults. The create form exposes all of these except `generationMode` (hardcoded via form `initialValues` / API default).

### 4.4 State and audit

| Field | Type | Default | Meaning |
|---|---|---|---|
| `isActive` | Boolean | `true` | Intended visibility flag. Create always sets `true`. UI has no toggle. Delete sets `false`. |
| `isDeleted` | Boolean | `false` | Soft-delete flag. All reads exclude `isDeleted: true`. |
| `createdBy` | ObjectId → User | unset | Optional. Create API accepts it; the admin UI never sends it. |

`deletedAt` is written in the DELETE handler but **is not on the schema**. Mongoose is strict by default, so `deletedAt` is stripped and does not persist. Soft delete is actually just `isDeleted: true` + `isActive: false`.

---

## 5. Prerequisite content (what must exist before creation)

A mock test cannot invent questions. The bank must already contain enough **active, non-deleted** questions that match the chosen scope and difficulty mix.

### 5.1 Subjects and topics

- Subjects are created under **Subjects**. A subject has `name`, `description`, and a `topics` array of Topic ObjectIds.
- Topics are created independently under **Topics**, then **attached to a subject**. The subject→topic link is owned by `Subject.topics`, not by the Topic document.
- Topic dropdown on the mock-test form loads `GET /api/topic/subject/:subjectId`, which:
  1. Loads the subject.
  2. Reads `subject.topics`.
  3. Returns only topics that are `isActive: true` and `isDeleted: false`.
- Changing the subject in the form **clears the topic** and reloads that subject's topics.
- Topic is **optional**. If the subject has no topics, the topic select stays disabled and the test is subject-wide.
- If the subject has topics, the admin can still leave topic empty (`allowClear`) to sample across the whole subject.

### 5.2 Exams

- Exams are created under **Exams**, nested under Category → Exam Group.
- An exam has its own `subjects[]` blueprint (`numberOfQuestions`, `marksPerQuestion`, negative marking, optional `sessionTime`).
- The mock-test exam dropdown loads `GET /api/exam/list?limit=100` (active, non-deleted).
- **There is no check** that the selected subject belongs to the selected exam's `subjects[]`.

### 5.3 Questions

Questions are created from Dashboard (`/admin`), Questions, or Bulk Upload. Fields that matter for sampling:

| Question field | Role in sampling |
|---|---|
| `subject` | **Required match.** |
| `topic` | Match only if the mock test has a topic. If the mock test has no topic, questions with any/no topic under that subject are eligible. |
| `difficultyLevel` | `"easy"` \| `"medium"` \| `"hard"`. Questions **without** a difficulty are never sampled. |
| `isActive` | Must be `true`. |
| `isDeleted` | Must be `false`. |
| `exams[]` | **Ignored** during mock-test sampling. |
| `tag` | **Ignored** during mock-test sampling. |

A question is eligible for a given bucket only if it matches **all** of: subject, optional topic, that difficulty, active, not deleted.

Dashboard question creation **requires** subject, topic, and difficulty. Bulk upload is a separate pipeline; whatever it stores still has to satisfy the same match filter to be pickable.

---

## 6. Admin UI flow (`/admin/mock-tests`)

The page is two cards: **Create New Mock Test** (top) and **All Mock Tests** (bottom).

### 6.1 Data loaded on mount

- Subjects: `GET /api/subject/list?limit=100` — active, non-deleted. Mapped to `{ value: _id, label: name }`.
- Exams: `GET /api/exam/list?limit=100` — same pattern.
- Mock tests: `GET /api/mock-test/list?page=&limit=` — see [§7](#7-list-get-apimock-testlist).

If there are more than 100 active subjects or exams, the rest never appear in the dropdowns.

### 6.2 Create form fields

**Required**

1. **Total Questions** — select: 10 / 15 / 20 / 25 / 30.
2. **Duration (Minutes)** — select: 10 / 15 / 20 / 25 / 30. Not coupled to question count.
3. **Exam** — searchable select.
4. **Subject** — select. On change: topic is cleared, topics for that subject are fetched.

**Optional**

5. **Topic** — enabled only when the subject has at least one active topic. Clearable.
6. **Test Title**
7. **Description**
8. **Marks Per Question** — `InputNumber`, min `0`, step `0.5`, default `1`.
9. **Negative Marking** — min `0`, step `0.25`, default `0`.
10. **Passing Score** — min `0`, optional, absolute score.
11. **Allow Retake** — switch, default on.
12. **Shuffle Options** — switch, default off.
13. **Show Results Immediately** — switch, default on.

`generationMode` is in form `initialValues` as `"STATIC"` but has **no visible field**. The API also defaults to `"STATIC"` if the field is omitted from the payload.

There is no `createdBy` field.

### 6.3 Difficulty distribution UI

Shown only after Total Questions is chosen.

On that change, defaults are computed as:

```
base      = floor(total / 3)
remainder = total % 3

easy   = base
medium = base + (remainder >= 2 ? 1 : 0)
hard   = base + (remainder >= 1 ? 1 : 0)
```

Worked examples:

| Total | Easy | Medium | Hard |
|---|---|---|---|
| 10 | 3 | 3 | 4 |
| 15 | 5 | 5 | 5 |
| 20 | 6 | 7 | 7 |
| 25 | 8 | 8 | 9 |
| 30 | 10 | 10 | 10 |

Remainder goes to **hard first, then medium**. Easy never receives the remainder.

Each of Easy / Medium / Hard is an independent slider from `0` to `totalQuestions`. They are **not** constrained to keep the running sum ≤ total while dragging. Validity is:

```
easy + medium + hard === totalQuestions
```

If invalid:

- Helper text turns red: `Total: X / N — Must equal N`.
- Submit button is disabled.
- `handleSubmit` also returns early with an error toast.

A mix of `10 / 0 / 0` for a 10-question test is valid (all easy). A mix of `0 / 0 / 0` is not, once a total is selected.

### 6.4 Submit

`POST /api/mock-test` with the form values plus `difficultyDistribution: { easy, medium, hard }`.

On success:

- Success toast.
- Form reset.
- Difficulty state reset to `{0,0,0}` and `totalQuestions` to `null` (sliders hide again).
- Table reloads.

On failure: toast with `data.error` from the API (this is how “not enough hard questions” surfaces).

The UI does **not** pre-check bank inventory. The first inventory check is on the server after submit.

### 6.5 List table

Columns: Title, Duration (`N mins`), Questions, Exam (cyan tag), Subject (blue tag), Topic (purple tag or `-`), Status (green Active / red Inactive), Actions.

Actions:

- **View** → `/admin/mock-tests/:id`
- **Delete** → confirm modal, then `DELETE /api/mock-test/:id`

There is **no Edit** action. The PUT API exists; the UI does not use it.

Pagination: page size 10, newest first (`createdAt: -1`). Changing page refetches.

Status in the table can theoretically show Inactive, but create always sets Active and the only UI path to Inactive is delete — and deleted rows are excluded from the list. So in practice the table is all Active, unless something else (e.g. a direct DB/API write) deactivated a test without deleting it.

### 6.6 Detail page (`/admin/mock-tests/[id]`)

Read-only. Loads `GET /api/mock-test/:id`. On failure, toast + redirect to the list.

Shows every stored field (title, status, counts, duration, exam, subject, topic, difficulty mix, marks, negative marking, passing score, generation mode, retake / shuffle / results flags, description, created at).

Questions table:

- Truncated English text: `questionText.en.text` first 100 characters + `"..."`.
- Subject tag — **this will usually be `N/A`**. The GET populate is `questionIds` with `select: 'questionText subject'`, which leaves `subject` as a raw ObjectId. There is no nested populate of `subject.name`.

There is no edit, no regenerate, no activate/deactivate, no delete on the detail page.

---

## 7. List (`GET /api/mock-test/list`)

Query params:

| Param | Default | Meaning |
|---|---|---|
| `page` | `1` | 1-based |
| `limit` | `10` | Page size |

Filter: `{ isDeleted: false }` only. **Does not filter `isActive`.**

Sort: `createdAt` descending.

Populate: `exam.name`, `subject.name`, `topic.name`, `createdBy.name email`. Does **not** populate `questionIds` (list stays light).

Response:

```json
{
  "mockTests": [ /* documents */ ],
  "pagination": { "total": 0, "page": 1, "limit": 10, "totalPages": 0 }
}
```

No search, no filter by exam/subject/topic, no sort options.

---

## 8. Create (`POST /api/mock-test`)

This is the heart of the module.

### 8.1 Request body (effective)

```json
{
  "totalQuestions": 10,
  "durationInMinutes": 15,
  "exam": "<Exam ObjectId>",
  "subject": "<Subject ObjectId>",
  "topic": "<Topic ObjectId | omitted>",
  "difficultyDistribution": { "easy": 3, "medium": 3, "hard": 4 },
  "title": "optional",
  "description": "optional",
  "generationMode": "STATIC",
  "marksPerQuestion": 1,
  "negativeMarking": 0,
  "passingScore": null,
  "allowRetake": true,
  "shuffleOptions": false,
  "showResultsImmediately": true,
  "createdBy": "<User ObjectId, unused by UI>"
}
```

### 8.2 Server guards (in order)

1. **`totalQuestions`** must be present and in `{10, 15, 20, 25, 30}`. Else `400`: `"Total questions must be one of: 10, 15, 20, 25, 30"`.
2. **`durationInMinutes`** same enum. Else `400`: `"Duration must be one of: 10, 15, 20, 25, 30"`.
3. **`subject`** required. Else `400`: `"A subject is required"`.
4. **`exam`** required. Else `400`: `"An exam is required"`.
5. **`difficultyDistribution`** must exist and include `easy`, `medium`, and `hard` (each may be `0`, but not `undefined`). Else `400`: `"Difficulty distribution (easy, medium, hard) is required"`.
6. **Sum check**: `easy + medium + hard === totalQuestions`. Else `400` with both numbers in the message.
7. **Inventory check per difficulty** (see [§8.3](#83-question-sampling)). If a bucket is short: `400` with `error`, `availableQuestions`, `difficulty`. **The test is not created.** Already-sampled buckets are discarded.

Not validated:

- Exam exists / is active / is not deleted.
- Subject exists / is active / is not deleted.
- Topic exists, is active, or **belongs to the selected subject**.
- Subject is one of the exam's configured subjects.
- Title uniqueness.
- `marksPerQuestion` / `negativeMarking` / `passingScore` ranges (beyond what mongoose/UI allow).
- Duplicate mock tests with the same exam + subject + topic + mix.
- `createdBy` is a real user.

Invalid ObjectIds throw and become `500` `"Failed to create mock test"`.

### 8.3 Question sampling

For each of `easy`, `medium`, `hard` in that order:

- If count is `0`, skip (avoids `$sample` with size 0).
- Run a MongoDB aggregation:

```
$match: {
  subject: ObjectId(subject),
  isActive: true,
  isDeleted: false,
  difficultyLevel: "<level>",
  topic: ObjectId(topic)   // only if body.topic is truthy
}
$sample: { size: count }
```

`$sample` picks a **random** subset. Re-creating the same configuration yields a **different paper** (unless the pool is so small that the same IDs are inevitable).

If `questions.length < count`, abort with:

```json
{
  "error": "Not enough hard questions available. Found 2, need 4",
  "availableQuestions": 2,
  "difficulty": "hard"
}
```

On success, concatenate in **easy → medium → hard** order. That becomes `questionIds`. There is no final shuffle across difficulties, so the stored order is grouped by difficulty.

A question cannot appear twice in one test: each document has a single `difficultyLevel`, and each bucket samples distinct docs. The same question **can** appear in many mock tests.

**Exam is not in `$match`.** Questions tagged to other exams, or to no exam, are eligible if subject/topic/difficulty/active match.

**Topic omitted** means no topic predicate: questions with topic A, topic B, or no topic at all are all eligible, as long as `subject` matches.

### 8.4 Persist

Document written:

| Field | Value |
|---|---|
| `totalQuestions`, `durationInMinutes`, `exam`, `subject` | from body |
| `topic` | `body.topic \|\| null` |
| `difficultyDistribution` | the three counts |
| `title`, `description` | `body.* \|\| null` |
| `generationMode` | `body.generationMode \|\| "STATIC"` |
| `questionIds` | sampled `_id`s |
| `marksPerQuestion` | `body.marksPerQuestion \|\| 1` (**so `0` becomes `1`**) |
| `negativeMarking` | `body.negativeMarking \|\| 0` |
| `passingScore` | `body.passingScore \|\| null` |
| `allowRetake` | default `true` if `undefined` (`false` is preserved) |
| `shuffleOptions` | default `false` if `undefined` |
| `showResultsImmediately` | default `true` if `undefined` |
| `isActive` | always `true` |
| `isDeleted` | always `false` |
| `createdBy` | only if provided |

Response `201`:

```json
{
  "message": "Mock test created successfully",
  "mockTest": { /* populated exam, subject, topic, questionIds (questionText + subject) */ }
}
```

---

## 9. Get one (`GET /api/mock-test/:id`)

- `findOne({ _id, isDeleted: false })`.
- Soft-deleted → `404` `"Mock test not found"`.
- Populate: `exam.name`, `subject.name`, `topic.name`, `questionIds` (`questionText`, `subject` only), `createdBy` (`name`, `email`).
- Returns the document JSON (not wrapped).

---

## 10. Update (`PUT /api/mock-test/:id`)

Implemented, **unused by the admin UI**. Behaviour still matters if anything else calls it.

### 10.1 Validation (weaker than create)

- If `totalQuestions` is sent and `<= 0` → `400`. **Does not re-check the 10–30 enum** in the route. Schema `enum` + `runValidators: true` still reject other values at save.
- If `durationInMinutes` is sent and `<= 0` → `400`. Same enum story.
- No dedicated “exam/subject required” checks (those fields are just `$set`).

### 10.2 When the paper is regenerated

Re-sampling runs **only if all three** are present in the body:

`subject` **and** `totalQuestions` **and** `difficultyDistribution`

Then:

1. Distribution sum must equal `totalQuestions`.
2. Same `$match` + `$sample` loop as create (topic included if `body.topic` is truthy).
3. Same “not enough questions” abort.
4. `questionIds` replaced with the new sample.

If any of those three is missing, existing `body.questionIds` is used if provided; otherwise the stored paper is left unchanged.

Implications:

- Changing **only** title/duration/flags does not re-sample (if the client omits the three-field combo).
- A client that sends the full document (including the three fields) **always re-samples**, even if subject/topic/mix did not change — a new random paper.
- If `topic` is omitted, update sets `topic: null` and, if regenerating, samples the **whole subject**.

### 10.3 Fields written

`$set` of: totalQuestions, durationInMinutes, exam, subject, topic (`null` if omitted), difficultyDistribution, title, description, generationMode, marksPerQuestion, negativeMarking, passingScore, allowRetake, shuffleOptions, showResultsImmediately, and `questionIds` if resolved.

**Not updated:** `isActive`, `isDeleted`, `createdBy`.

`findOneAndUpdate({ _id, isDeleted: false }, …, { new: true, runValidators: true })`. Missing/deleted → `404`.

---

## 11. Delete (`DELETE /api/mock-test/:id`)

Soft delete:

```
isDeleted: true
isActive: false
deletedAt: new Date()   // stripped by schema strict mode; does not persist
```

UI confirm copy says the action cannot be undone. There is no restore endpoint. The row disappears from list and GET.

Already-deleted → `404`.

---

## 12. Relationship to Exam and the question bank

This is the main conceptual trap.

### 12.1 Exam on a mock test is a filing label

Create **requires** an exam so the test can be grouped under one in the student product. Sampling **does not** use:

- `Exam.subjects[]` (blueprint counts/marks)
- `Question.exams[]`

So this is allowed:

- Exam “SSC CGL” whose blueprint subjects are Quant + English.
- Mock test filed under SSC CGL, subject **History**, topic **World War II**.
- Questions sampled from History even if they were never tagged to SSC CGL.

### 12.2 Subject-only vs subject+topic papers

Two legal shapes:

| Shape | `topic` | Pool |
|---|---|---|
| Subject-wide | `null` | All active questions for that subject, any topic |
| Topic-specific | set | Only that topic |

Admins create these **one at a time**. There is no “generate a pack for every topic” helper, no uniqueness constraint, and no auto-link from “new questions added to this topic”.

### 12.3 Exam blueprint vs mock-test scoring

Exam subject rows have their own `marksPerQuestion`, `hasNegativeMarking`, `negativeMarksPerQuestion`. Mock tests have a **single** `marksPerQuestion` and `negativeMarking` for the whole paper. They are not copied from the exam on create. The admin sets them on the mock-test form (defaults 1 and 0).

Duration is also independent: exam `duration` is not copied into `durationInMinutes`.

### 12.4 STATIC paper vs live bank

After creation, `questionIds` is the paper. Later:

- New questions in that topic **do not** join existing tests.
- Soft-deleted questions **remain** in `questionIds`.
- Difficulty edits on a question **do not** rebalance an existing test.

That is intentional for STATIC: every student sees the same items (aside from `shuffleOptions` at attempt time, which this app does not execute).

---

## 13. End-to-end creation walkthrough

```
Admin opens /admin/mock-tests
        │
        ├─ GET /api/subject/list?limit=100
        ├─ GET /api/exam/list?limit=100
        └─ GET /api/mock-test/list?page=1&limit=10
        │
Admin selects Total Questions = 10
        └─ sliders appear: Easy 3 / Medium 3 / Hard 4
        │
Admin selects Duration = 15, Exam = "SSC CGL"
Admin selects Subject = "Quantitative Aptitude"
        ├─ topic field cleared
        └─ GET /api/topic/subject/:subjectId
              └─ Topic dropdown: Simplification, Algebra, …
        │
Admin optionally picks Topic = "Algebra"
Admin optionally adjusts sliders so 3+3+4 = 10
Admin optionally fills title, marks, flags
        │
Admin clicks Create Mock Test
        │
POST /api/mock-test
        ├─ enum + required + distribution-sum guards
        ├─ $sample 3 easy  Algebra + Quant + active
        ├─ $sample 3 medium Algebra + Quant + active
        ├─ $sample 4 hard   Algebra + Quant + active
        │     └─ if any bucket short → 400, nothing saved
        └─ MockTest.create({ questionIds: [...10 ids], isActive: true, … })
        │
201 → toast, form reset, table refresh
        │
Student product (outside this repo) lists active, non-deleted
mock tests (typically by exam/subject/topic) and serves
the frozen questionIds as the paper.
```

---

## 14. Guards cheat sheet

### Client (create form)

| Guard | Effect |
|---|---|
| Ant Design `required` on totalQuestions, duration, exam, subject | Cannot submit |
| Difficulty sum must equal total | Button disabled + submit early-return |
| Topic select disabled until the subject has topics | Prevents picking a topic from another subject in the UI |
| Subject change clears topic | Prevents stale topic IDs |
| Marks / negative / passing min 0 | UI only |
| Confirm modal on delete | Accidental delete |

### Server (create)

| Guard | Status |
|---|---|
| totalQuestions ∈ {10,15,20,25,30} | 400 |
| durationInMinutes ∈ {10,15,20,25,30} | 400 |
| subject present | 400 |
| exam present | 400 |
| difficultyDistribution complete | 400 |
| mix sum === totalQuestions | 400 |
| enough questions per difficulty in the matched pool | 400 + `availableQuestions` |
| schema enums / required on save | 500 if something else slips through |

### Server (update / delete / get)

| Guard | Status |
|---|---|
| Document exists and `isDeleted: false` | 404 |
| Update: totalQuestions / duration > 0 if provided | 400 |
| Update: mix sum if regenerating | 400 |
| Update: inventory if regenerating | 400 |
| Schema validators on update | 400/500 via mongoose |

### Explicitly not guarded

- Auth / role / `createdBy`
- Exam ↔ subject membership
- Topic ↔ subject membership (API will sample with whatever topic ID is sent)
- Question.exams membership
- Bank inventory before submit (no preview count)
- Title required / unique
- Duplicate papers
- `isActive` toggle in UI
- Cascading cleanup if a subject/topic/question is later deleted
- Restore after soft delete
- `marksPerQuestion: 0` (API coalesces it to `1`)

---

## 15. STATIC vs DYNAMIC

Schema:

```js
generationMode: { enum: ["STATIC", "DYNAMIC"], default: "STATIC" }
```

| Mode | Intended meaning | Actual behaviour |
|---|---|---|
| **STATIC** | Sample at create/update, store `questionIds`, every attempt uses that list | **This is what runs.** |
| **DYNAMIC** | Presumably sample a new paper per attempt from the same scope | **Not implemented.** Create/update still sample and store `questionIds` the same way. |

The create form does not expose the switch. Treat DYNAMIC as reserved.

---

## 16. How this is shown to the user (student side)

This repository is the **admin authoring app**. It does not render a take-test UI.

What the student product can rely on from this module:

1. A mock test is a **pre-built paper** (`questionIds`) scoped to **one exam + one subject + optional topic**.
2. Tests are meant to be listed when `isDeleted: false` (and likely `isActive: true`, though the admin list itself does not require `isActive`).
3. Size and timer are the enums above; they need not match each other or the parent exam.
4. Scoring flags on the document are the source of truth for that paper, not the exam blueprint.
5. Creating another mock test with the same subject/topic is how you offer a **second paper** — there is no “variant” field; they are sibling documents.

Admins must create each paper they want students to see. Nothing auto-generates from “subject X has N questions”.

---

## 17. Historical shape (why the model looks like this)

| When | Change |
|---|---|
| Initial | Multi-`subjects[]`, required title, free-form question count/duration, single `difficultyLevel` for the whole test |
| Later | Single `subject` + optional `topic`; question count and duration restricted to 10–30 |
| Later | `difficultyLevel` replaced by `difficultyDistribution` {easy, medium, hard} with per-bucket `$sample` |
| Later | Required `exam` reference (association only) |

Comments in the schema still say “STATIC mode for now” and “Frozen question set (very important)” — that remains the design.

---

## 18. Operational checklist for an admin

Before creating a topic-level 10-question test with mix 3/3/4:

1. Subject exists, is active, not deleted.
2. Topic exists, is attached to that subject, is active, not deleted.
3. Exam exists, is active, not deleted (for filing, not for sampling).
4. Question bank has **at least 3 easy + 3 medium + 4 hard** questions with that subject **and** topic, all active, not deleted, each with `difficultyLevel` set.
5. Pick duration independently (often matched to size by convention, not by code).
6. Set title if students should distinguish this paper from others on the same topic.
7. After create, **View** the test and confirm the question count is 10. (Subject names on that table are currently unreliable; use the English snippet.)

If create fails with “Not enough X questions”:

- Lower that slider, or
- Drop the topic (widen to the whole subject), or
- Add more questions of that difficulty under that subject/topic.

There is no admin screen that shows “how many easy/medium/hard are available for this subject/topic” before submit.

---

## 19. Known gaps and sharp edges

1. **No edit UI** despite PUT.
2. **No activate/deactivate** control; `isActive` is only flipped on delete.
3. **Exam does not filter questions.**
4. **Topic-subject consistency is UI-only.**
5. **`$sample` is random** — no seed, no “exclude questions already used in other mock tests”.
6. **Paper order is grouped by difficulty**, not shuffled as a whole.
7. **Soft-deleted questions can linger** on frozen papers.
8. **`deletedAt` does not persist.**
9. **`marksPerQuestion: 0` is stored as `1`** because of `|| 1`.
10. **Dropdown cap of 100** subjects/exams.
11. **Detail page subject column** on questions does not populate names.
12. **No auth** on APIs.
13. **`createdBy` is unused.**
14. **List has no filters** (exam/subject/topic/search).
15. **DYNAMIC mode is a stub.**
16. **Passing score** is absolute and never validated against `totalQuestions * marksPerQuestion`.
17. **Mongoose model cache is deleted on every import** of `MockTest.js` (hot-reload workaround); unrelated to product behaviour but unusual.

---

## 20. API summary

| Method | Path | UI usage | Result |
|---|---|---|---|
| `POST` | `/api/mock-test` | Create form | Sample + insert, `201` |
| `GET` | `/api/mock-test/list?page&limit` | Table | Paginated, non-deleted |
| `GET` | `/api/mock-test/:id` | Detail | One non-deleted test + questions |
| `PUT` | `/api/mock-test/:id` | **None** | Patch; may re-sample |
| `DELETE` | `/api/mock-test/:id` | Table delete | Soft delete |

Supporting reads used by the create form:

| Method | Path | Why |
|---|---|---|
| `GET` | `/api/subject/list?limit=100` | Subject dropdown |
| `GET` | `/api/exam/list?limit=100` | Exam dropdown |
| `GET` | `/api/topic/subject/:subjectId` | Topic dropdown after subject is chosen |
