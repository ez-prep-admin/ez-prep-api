# Access Control

## 1. Single authority

`AccessControlService` (name may be `EntitlementAccessService`) is the **only** component that answers:

```text
canAccessMockTest(userId, mockTestId): AccessDecision
```

Controllers and frontends must not reimplement grant hierarchy.

---

## 2. Decision algorithm

```text
Load MockTest (active, not deleted)
  │
  ├─ accessMode === FREE
  │     → allow (reason ALLOWED / FREE)
  │
  └─ accessMode === ENTITLED
        Load Exam (+ examGroup id)
        Load user's ACTIVE entitlements (status ACTIVE and (expiresAt null or > now))
        Candidate matches (any one sufficient):
          1. scopeType MOCK_TEST && scopeId === mockTestId
          2. scopeType EXAM && scopeId === exam.id
          3. scopeType EXAM_GROUP && scopeId === exam.examGroup
        │
        ├─ match → allow
        └─ no match
              ├─ enforcement LEGACY → allow (LEGACY_ALLOW) + metric/log
              └─ enforcement ENFORCED → deny (ENTITLEMENT_REQUIRED)
```

Unauthenticated users: existing JWT rules on attempts unchanged (attempts require auth).

---

## 3. Enforcement points

| Operation | Policy |
| --- | --- |
| `startAttempt` | **Must** call AccessControlService; deny blocks create |
| Resume / continue `IN_PROGRESS` | Allow if attempt owned and `IN_PROGRESS`; **do not** re-check entitlement (D-08 / U-LEG-01 resolved) |
| `submitAttempt` / answer mutations | Ownership of already-started attempt; **do not** re-check entitlement |
| New attempt after submit | Requires currently valid access via `startAttempt` |
| List/get papers | Attach `access` DTO; do not hide ENTITLED papers |
| Admin preview | Unaffected / admin role bypass only if explicitly productized — **default: admins still use admin tools, student endpoints stay student rules** |

FREE on a paper means that paper needs no entitlement — **not** that the user has access to all content. When admins flip a paper to `ENTITLED` (or sell it via a product), users without a covering entitlement are denied.

---

## 4. View plans matching

Given `examId` or `mockTestId`, return PUBLISHED products where grants cover:

**For mock test:** MOCK_TEST id, or EXAM of paper, or EXAM_GROUP of that exam.

**For exam:** EXAM id or EXAM_GROUP of exam.

Include ACTIVE offers (with effective price) for checkout display.

---

## 5. FREE vs promotion

- `accessMode: FREE` on paper = no entitlement required.
- Time-limited promo access for ENTITLED papers = create Entitlement with `sourceType: PROMOTION` / `TRIAL`, not by flipping accessMode globally.

---

## 6. Dynamic exam-group

Do **not** expand EXAM_GROUP into exam IDs at purchase time for authorization. Store EXAM_GROUP entitlement; resolve at access time so new exams inherit access.

---

## 7. Caching (optional later)

Mongo is SoT. Optional Redis cache via `RedisKeyBuilder.key('entitlement', userId)` with invalidation on provision/revoke/refund. Not required for phase 02 correctness.

---

## 8. Hostile client cases (must pass tests)

1. User forges Start via DevTools without entitlement → 403 + ENTITLEMENT_REQUIRED.
2. User posts create-order with tiny amount → ignored; server uses offer.
3. User calls verify with forged payment ids → signature fail; no provision.
4. Double webhook → one provision set.
5. Expired entitlement → deny start; allow submit on open attempt.
6. Entitlement for unrelated exam → deny.
7. EXAM_GROUP pack + newly created exam in group → allow without migration.
8. FREE paper + ENFORCED mode → allow.
