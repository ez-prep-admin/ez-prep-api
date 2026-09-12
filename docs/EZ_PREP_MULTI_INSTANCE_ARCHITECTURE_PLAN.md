# EZ Prep Multi-Instance / White-Label Architecture & Implementation Plan

**Document purpose:** This is the implementation plan for evolving the current EZ Prep application into a reusable, multi-instance platform. The immediate goal is to support two independent production instances:

- `ezprep`
- `examflex`

The long-term goal is to support many white-label clients/institutions without creating client-specific code forks, while allowing each instance to have isolated application data, sessions/cache/queues, domains, branding, payment configuration, and feature configuration.

---

## 0. Final Architecture Decision

The core model is:

> **One codebase -> one release artifact -> many independently configured deployments.**

A "deployment" means one complete running instance of EZ Prep.

For now:

```text
                         GITHUB
                           |
                        main
                           |
                    GitHub Actions
                      /         \
                     /           \
              EZ Prep API     ExamFlex API
              DO Droplet A    DO Droplet B
                    |               |
                 PM2/Nginx       PM2/Nginx
                    |               |
                    +-------+-------+
                            |
                     MongoDB Atlas M2
                       shared cluster
                            |
                  +---------+---------+
                  |                   |
               ezprep              examflex
```

Frontend applications live independently on Vercel:

```text
Git repository
      |
      +---- Vercel Project: EZ Prep Web
      |
      +---- Vercel Project: ExamFlex Web
```

Both Vercel projects use the same frontend codebase and the same `main` branch, but have different environment variables and production domains.

Runtime data isolation:

```text
EzPrep API
  -> MongoDB database: ezprep
  -> Redis namespace: ezprep:*
  -> S3 prefix: ezprep/*

ExamFlex API
  -> MongoDB database: examflex
  -> Redis namespace: examflex:*
  -> S3 prefix: examflex/*
```

At this stage, Redis can be one Upstash Redis database shared by both instances, but keys and BullMQ queues must be namespaced.

Later, a client can move from:

```text
1 Droplet
```

to:

```text
multiple replicas + load balancer
```

and eventually:

```text
Kubernetes / dedicated infrastructure
```

without changing the application architecture.

---

# 1. Architecture Principles

These rules should guide every future implementation.

## Rule 1: One codebase

Do not create:

```text
ezprep branch
examflex branch
client-a branch
client-b branch
```

for normal product differences.

Use one codebase.

## Rule 2: Configuration controls differences

These should not require code changes:

- domain
- API URL
- CORS origins
- MongoDB database
- Redis URL
- S3 bucket/prefix
- payment merchant/account
- branding
- labels
- enabled features
- exam/product settings

## Rule 3: Feature flags control feature availability

Build a feature once. Decide which instance sees it using configuration.

## Rule 4: Strategy/plugin patterns handle genuine behavioral differences

For something like a genuinely different scoring algorithm, use:

```text
interface
  -> Standard strategy
  -> NEET strategy
  -> Client-specific strategy
```

Do not scatter:

```typescript
if (instance === 'examflex') ...
```

throughout business logic.

## Rule 5: Environment variables are for infrastructure/runtime secrets

Examples:

```text
MONGODB_URI
REDIS_URL
AWS credentials
OPENAI_API_KEY
PAYMENT_SECRET
CORS_ORIGINS
INSTANCE_ID
```

## Rule 6: MongoDB-backed instance configuration is for product behavior

Examples:

```text
feature flags
terminology
branding
product settings
exam settings
```

## Rule 7: Every backend instance is stateless

Do not rely on:

- in-memory sessions
- local uploaded files
- local cache
- process memory as source of truth
- local filesystem for persistent application data

Persistent/stateful dependencies should be externalized to MongoDB, Redis, S3, etc.

## Rule 8: The customer's data is isolated by database

Prefer:

```text
ezprep database
examflex database
client-a database
client-b database
```

rather than putting every client's data in shared collections with `tenantId`, at least for the current architecture.

This keeps application queries simple and reduces accidental cross-client data access.

---

# 2. Immediate Target State

The immediate target is:

```text
INSTANCE: EZ PREP
  MongoDB: ezprep
  Redis: same Upstash Redis, prefix ezprep:
  S3: shared bucket, prefix ezprep/
  Backend: DO Droplet A
  Frontend: Vercel Project A
  Domain: EZ Prep domain
  Payment: EZ Prep merchant/account
```

and:

```text
INSTANCE: EXAMFLEX
  MongoDB: examflex
  Redis: same Upstash Redis, prefix examflex:
  S3: shared bucket, prefix examflex/
  Backend: DO Droplet B
  Frontend: Vercel Project B
  Domain: ExamFlex domain
  Payment: ExamFlex merchant/account
```

---

# 3. Important MongoDB Naming Convention

The current production database is named:

```text
live
```

Rename it to:

```text
ezprep
```

Create:

```text
examflex
```

Do not touch these system/internal databases:

```text
admin
local
config
```

The screenshot currently shows `admin`, `live`, and `local`. `live` is the application database. `admin` and `local` are MongoDB system/internal databases and are not part of the application migration.

Recommended future naming:

```text
ezprep
examflex
abc_academy
xyz_institute
...
```

Use lowercase, stable slugs.

---

# 4. MongoDB: Create `ezprep` by Cloning `live`

## Objective

Current:

```text
live
  categories
  currentaffairs
  examgroups
  exams
  failed_questions
  fullmocktestdrafts
  mocktestattempts
  mocktests
  otp_sessions
  question_uploads
  questions
  subjects
  tags
  topics
  users
```

Target:

```text
ezprep
  categories
  currentaffairs
  examgroups
  exams
  failed_questions
  fullmocktestdrafts
  mocktestattempts
  mocktests
  otp_sessions
  question_uploads
  questions
  subjects
  tags
  topics
  users
```

The data and indexes should be copied, not reconstructed manually.

## Step 4.1: Take a backup before doing anything

Before renaming/copying a production database, take a backup.

Recommended local backup:

```bash
mongodump \
  --uri="<YOUR_ATLAS_CONNECTION_STRING>" \
  --db=live \
  --archive=live-backup-$(date +%Y%m%d-%H%M%S).archive
```

Store the backup somewhere safe.

Do not delete `live` until the new `ezprep` database has been completely verified.

## Step 4.2: Stop application writes during the migration window

Because the database is production data, avoid copying while users are actively changing data if you need a clean cutover.

Recommended sequence:

```text
Put application into maintenance/read-only mode
        |
        v
Take final dump
        |
        v
Restore into ezprep
        |
        v
Verify
        |
        v
Change backend to ezprep
        |
        v
Smoke-test application
        |
        v
Exit maintenance
```

If the application remains writable while the dump is running, some writes may land after the dump has already copied those collections. For this migration, a short maintenance window is safer.

## Step 4.3: Clone `live` -> `ezprep`

Using `mongodump` + `mongorestore`:

```bash
mongodump \
  --uri="<ATLAS_URI>" \
  --db=live \
  --archive=live.archive
```

Then:

```bash
mongorestore \
  --uri="<ATLAS_URI>" \
  --archive=live.archive \
  --nsFrom='live.*' \
  --nsTo='ezprep.*'
```

Do not add `--drop` on the first restore into a brand-new database.

If you are repeating the restore after a failed attempt, explicitly decide whether you want to drop/recreate the target database before restoring.

## Step 4.4: Verify every collection

In `mongosh`:

```javascript
const live = db.getSiblingDB("live");
const ezprep = db.getSiblingDB("ezprep");

live.getCollectionNames().forEach((name) => {
  print(
    name,
    "live=" + live.getCollection(name).countDocuments(),
    "ezprep=" + ezprep.getCollection(name).countDocuments()
  );
});
```

The counts should match for the migrated collections.

Also verify:

- indexes
- sample users
- sample questions
- exams
- mock tests
- attempts
- uploads
- relationships/references
- TTL indexes where applicable

For index inspection:

```javascript
db.getSiblingDB("live").questions.getIndexes();
db.getSiblingDB("ezprep").questions.getIndexes();
```

Repeat for important collections.

## Step 4.5: Change the production EzPrep URI

Current:

```env
MONGODB_URI=mongodb+srv://.../live
```

Target:

```env
MONGODB_URI=mongodb+srv://.../ezprep
```

Do this only after `ezprep` has been verified.

## Step 4.6: Deploy and smoke-test EZ Prep

Verify:

- application starts
- login/OTP works
- question APIs work
- exams work
- mock tests work
- attempts work
- admin operations work
- image/file URLs work
- background operations work
- Mongo writes are going to `ezprep`

Run a simple write/read test and check the document appears in `ezprep`, not `live`.

## Step 4.7: Keep `live` temporarily

Do not delete `live` immediately.

Keep it for a defined safety period, for example several days, while monitoring production.

Once you are confident:

```text
ezprep = active
live   = old migration source
```

then drop `live`.

In Atlas Data Explorer, select the `live` database and use Drop Database.

Do not drop `admin`, `local`, or other internal databases.

---

# 5. MongoDB: Create `examflex`

You asked whether:

```text
mongodb+srv://.../examflex
```

automatically creates the database.

MongoDB creates a database when data is first written to it. Simply changing the database name in a URI does not by itself create a visible database with collections. Atlas also provides an explicit Create Database UI where you create the database together with its first collection.

For this project, do not rely on implicit creation.

Create the database intentionally because you also need to initialize its configuration and indexes.

## Step 5.1: Create in Atlas

In Atlas:

```text
Data Explorer
  -> Create Database
```

Use:

```text
Database: examflex
Collection: instance_configs
```

Then insert the initial configuration document.

Example:

```json
{
  "_id": "singleton",
  "schemaVersion": 1,
  "instanceId": "examflex",
  "displayName": "ExamFlex",
  "features": {
    "leaderboard": false,
    "advancedAnalytics": false,
    "aiExplanations": true,
    "pdfQuestionUpload": true
  },
  "terminology": {
    "subject": "Chapter",
    "subjects": "Chapters",
    "topic": "Unit",
    "topics": "Units",
    "mockTest": "Practice Test",
    "mockTests": "Practice Tests"
  },
  "branding": {
    "displayName": "ExamFlex",
    "logoUrl": null,
    "faviconUrl": null,
    "primaryColor": null
  },
  "product": {
    "examFamily": "competitive-exams"
  },
  "updatedAt": null,
  "updatedBy": "system"
}
```

The exact fields can evolve.

The important point is that there is exactly one active configuration document:

```text
instance_configs
  -> _id = singleton
```

Do not create multiple configuration documents for the same instance.

---

# 6. Instance Identity

Add these environment variables to every backend deployment:

## EZ Prep

```env
INSTANCE_ID=ezprep
INSTANCE_NAME=EZ Prep
```

## ExamFlex

```env
INSTANCE_ID=examflex
INSTANCE_NAME=ExamFlex
```

`INSTANCE_ID` is a stable technical identifier.

Do not use a human-editable display name as an identifier.

Good:

```text
INSTANCE_ID=abc_academy
```

Bad:

```text
INSTANCE_ID=ABC Academy - The Best Institute!!!
```

The instance ID will eventually be used in:

- Redis prefixes
- S3 prefixes
- deployment records
- logs
- metrics
- feature configuration
- queue naming
- audit records

---

# 7. Where Tenant/Instance Configuration Lives

There are two different kinds of data.

## 7.1 Platform/control-plane data

A future central database:

```text
ezprep_platform
```

contains things such as:

```text
deployments
release records
infrastructure status
domains
desired application version
current application version
deployment health
customer metadata
plan/tier
```

Example:

```json
{
  "deploymentId": "examflex",
  "databaseName": "examflex",
  "environment": "production",
  "status": "healthy",
  "currentVersion": "2.15.0",
  "desiredVersion": "2.15.0",
  "infrastructureTier": "standard",
  "webDomain": "https://examflex.example.com",
  "apiDomain": "https://api.examflex.example.com"
}
```

## 7.2 Runtime/product configuration

Store this inside each instance's own MongoDB:

```text
ezprep.instance_configs
examflex.instance_configs
client-a.instance_configs
```

The singleton configuration document contains:

- features
- terminology
- branding
- product behavior
- exam-family settings
- other non-secret client-specific behavior

This design keeps each instance self-contained.

The backend only needs to talk to:

```text
its own MongoDB
its own Redis
its own external services
```

It does not need the control-plane database for every normal request.

The control plane can update a client's configuration by connecting to that client's database using a privileged internal service.

---

# 8. Why Store Runtime Config in Each Instance DB?

For this platform, this is preferable to making every client backend depend on the central control-plane DB at runtime.

For example:

```text
ExamFlex backend
      |
      +--> examflex DB
      |       |
      |       +--> users
      |       +--> questions
      |       +--> exams
      |       +--> instance_configs
      |
      +--> Redis
      |
      +--> S3
```

If the control-plane service is down, ExamFlex can still operate with its cached/local configuration.

The control plane is an administrative system, not a runtime dependency.

---

# 9. `InstanceConfigService` in NestJS

Create a dedicated module:

```text
src/instance/
  instance.module.ts
  instance-config.service.ts
  instance-config.repository.ts
  feature.service.ts
  terminology.service.ts
  instance.types.ts
  instance.defaults.ts
  feature.enum.ts
```

The rest of the application should not directly query:

```text
instance_configs
```

everywhere.

Only the instance configuration service should know how configuration is loaded.

Conceptually:

```typescript
@Injectable()
export class InstanceConfigService {
  async getConfig(): Promise<InstanceConfig> {
    // 1. Try Redis
    // 2. If cache miss, load instance_configs/singleton from Mongo
    // 3. Merge with defaults
    // 4. Cache resolved configuration
    // 5. Return
  }
}
```

This becomes the single source of runtime configuration access.

---

# 10. Default Configuration

Do not store a giant configuration document for every client.

Create defaults in code:

```typescript
export const DEFAULT_INSTANCE_CONFIG = {
  features: {
    leaderboard: false,
    advancedAnalytics: false,
    aiExplanations: false,
    pdfQuestionUpload: true,
  },

  terminology: {
    subject: "Subject",
    subjects: "Subjects",
    topic: "Topic",
    topics: "Topics",
    mockTest: "Mock Test",
    mockTests: "Mock Tests",
  },
};
```

Then each client DB stores only overrides.

Example:

```json
{
  "_id": "singleton",
  "features": {
    "aiExplanations": true
  },
  "terminology": {
    "subject": "Chapter",
    "subjects": "Chapters"
  }
}
```

At runtime:

```text
DEFAULT_CONFIG
       +
CLIENT_OVERRIDES
       =
RESOLVED_CONFIG
```

This prevents configuration documents from becoming enormous and repetitive.

---

# 11. Configuration Schema Version

Every `instance_configs.singleton` document should have:

```json
{
  "_id": "singleton",
  "schemaVersion": 1
}
```

When the configuration structure changes:

```text
schemaVersion 1
        -> migration
schemaVersion 2
```

Do not silently assume every old customer has every new property.

Use defaults so older configuration documents continue to work.

---

# 12. Feature Flags

Create a single feature catalog in code.

Example:

```typescript
export enum Feature {
  LEADERBOARD = "leaderboard",
  ADVANCED_ANALYTICS = "advancedAnalytics",
  AI_EXPLANATIONS = "aiExplanations",
  PDF_QUESTION_UPLOAD = "pdfQuestionUpload",
}
```

This enum is the authoritative list of feature keys.

The database controls their values per instance.

Example:

```json
{
  "features": {
    "leaderboard": true,
    "advancedAnalytics": false,
    "aiExplanations": true
  }
}
```

Do not write:

```typescript
if (instanceId === "examflex") {
   ...
}
```

Instead write:

```typescript
if (featureService.isEnabled(Feature.AI_EXPLANATIONS)) {
   ...
}
```

Even better, use a guard/decorator for backend endpoints.

---

# 13. Backend Feature Guard

Create:

```text
FeatureGuard
Feature decorator
FeatureService
```

Usage:

```typescript
@Get("advanced")
@Feature(Feature.ADVANCED_ANALYTICS)
getAdvancedAnalytics() {
  ...
}
```

The guard checks the resolved instance configuration.

Result:

```text
EZ Prep:
advancedAnalytics = true
-> endpoint available

ExamFlex:
advancedAnalytics = false
-> endpoint rejected
```

The frontend hiding a feature is NOT sufficient security. The backend must independently enforce feature availability.

---

# 14. Frontend Feature Configuration

The Next.js frontend must not directly connect to MongoDB.

Expose a safe backend endpoint:

```text
GET /api/v1/instance/config
```

Return only public configuration:

```json
{
  "instance": {
    "id": "examflex",
    "displayName": "ExamFlex"
  },
  "features": {
    "leaderboard": false,
    "advancedAnalytics": false,
    "aiExplanations": true
  },
  "terminology": {
    "subject": "Chapter",
    "subjects": "Chapters",
    "topic": "Unit",
    "topics": "Units",
    "mockTest": "Practice Test"
  },
  "branding": {
    "displayName": "ExamFlex",
    "logoUrl": "...",
    "primaryColor": "..."
  }
}
```

Never return:

- Mongo credentials
- Redis credentials
- AWS secrets
- payment secrets
- OpenAI keys
- internal admin credentials

---

# 15. Frontend `FeatureGate`

Implement a reusable component:

```tsx
<FeatureGate feature="leaderboard">
  <Leaderboard />
</FeatureGate>
```

and a hook:

```tsx
const enabled = useFeature("advancedAnalytics");
```

Do not scatter instance checks through JSX.

Avoid:

```tsx
{isExamFlex ? <Chapter /> : <Subject />}
```

Use:

```tsx
<h2>{terminology.subject}</h2>
```

---

# 16. Terminology / Labels

Labels such as:

```text
Subject
Chapter
Topic
Unit
Mock Test
Practice Test
```

are configuration, not features.

Store:

```json
{
  "terminology": {
    "subject": "Chapter",
    "subjects": "Chapters",
    "topic": "Unit",
    "topics": "Units",
    "mockTest": "Practice Test",
    "mockTests": "Practice Tests"
  }
}
```

Create a terminology accessor:

```typescript
terminologyService.get("subject")
```

Frontend:

```tsx
const { subject } = useTerminology();

return <h2>{subject}</h2>;
```

For plural text, store both forms rather than attempting automatic pluralization.

---

# 17. Redis Architecture

Immediate target:

```text
One Upstash Redis database
        |
        +------------------+
        |                  |
   ezprep:*            examflex:*
```

Do not use separate logical "databases" unless your provider/features specifically require it.

Use prefixes.

## Session keys

```text
ezprep:session:<sessionId>
examflex:session:<sessionId>
```

## Cache keys

```text
ezprep:cache:questions:<id>
examflex:cache:questions:<id>
```

## Configuration

```text
ezprep:config:instance
examflex:config:instance
```

## Rate limits

```text
ezprep:ratelimit:<key>
examflex:ratelimit:<key>
```

## BullMQ

Use queue names that identify the instance:

```text
ezprep:pdf-processing
examflex:pdf-processing
```

and/or a BullMQ key prefix such as:

```text
ezprep:bullmq
examflex:bullmq
```

The critical rule is:

> Every key and every queue must be instance-scoped.

Do not allow:

```text
pdf-processing
```

to be shared ambiguously by both applications.

---

# 18. Redis Cache Invalidation

MongoDB is the source of truth.

When instance configuration changes:

```text
Admin dashboard
      |
      v
MongoDB instance_configs
      |
      v
invalidate Redis config key
      |
      v
next request reloads config
```

Preferred key:

```text
<instanceId>:config:instance
```

When the next request sees a cache miss:

```text
Redis miss
   |
MongoDB read
   |
merge defaults
   |
write Redis
   |
return config
```

At scale, this becomes:

```text
MongoDB = source of truth
Redis = cache
```

Do not make Redis the only copy.

---

# 19. Important Redis Safety Rule

Because EZ Prep and ExamFlex share the same Redis:

Never use:

```text
FLUSHDB
```

during normal application operations.

That would potentially remove both instances' data.

Use exact key invalidation or namespaced cleanup.

The same rule applies to any future maintenance script.

---

# 20. S3 Architecture

You can continue sharing the existing buckets.

Current:

```env
AWS_REGION=ap-south-1
AWS_S3_BUCKET=ez-prep-question-uploads
AWS_S3_IMAGE_BUCKET=ez-prep-image-bucket
```

Keep the bucket names if desired.

Add:

```env
S3_KEY_PREFIX=ezprep
```

for EZ Prep:

```env
S3_KEY_PREFIX=ezprep
```

and:

```env
S3_KEY_PREFIX=examflex
```

for ExamFlex.

Then generate keys like:

```text
ezprep/questions/...
ezprep/uploads/...

examflex/questions/...
examflex/uploads/...
```

Do not rely solely on ObjectId uniqueness for isolation.

The explicit instance prefix makes the boundary obvious.

Eventually, if an enterprise client needs dedicated storage:

```text
client-a -> dedicated bucket
```

without changing the application architecture.

---

# 21. Payment Gateway Design

Payment credentials and account identifiers are runtime configuration.

Example:

```env
PAYMENT_PROVIDER=razorpay
PAYMENT_ACCOUNT_ID=...
PAYMENT_KEY_ID=...
PAYMENT_KEY_SECRET=...
```

EzPrep has its values.

ExamFlex has its values.

Do not write:

```typescript
if (instanceId === "examflex") {
  useExamflexPaymentAccount();
}
```

Create an abstraction:

```text
PaymentService
     |
     +-- RazorpayProvider
     +-- StripeProvider
```

Business logic calls:

```typescript
paymentService.createOrder(...)
```

The provider configuration determines where/how the payment is created.

This allows:

```text
EzPrep -> Merchant A
ExamFlex -> Merchant B
```

with zero business-code change.

---

# 22. CORS Configuration

Do not hardcode production domains inside NestJS.

Use environment configuration.

EZ Prep:

```env
CORS_ORIGINS=https://ezprep.example.com,https://admin.ezprep.example.com
```

ExamFlex:

```env
CORS_ORIGINS=https://examflex.example.com,https://admin.examflex.example.com
```

NestJS:

```typescript
const origins = configService
  .getOrThrow<string>("CORS_ORIGINS")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.enableCors({
  origin: origins,
  credentials: true,
});
```

Do not use:

```text
origin: "*"
```

with credentialed authentication.

Preview environments should be handled deliberately rather than putting arbitrary wildcard origins into production CORS.

---

# 23. Environment Variable Categories

## Infrastructure/runtime

Keep these in `.env` / secret manager:

```text
INSTANCE_ID
INSTANCE_NAME
MONGODB_URI
REDIS_URL
AWS_REGION
AWS_S3_BUCKET
AWS_S3_IMAGE_BUCKET
S3_KEY_PREFIX
CORS_ORIGINS
PUBLIC_WEB_URL
PUBLIC_API_URL
PAYMENT_PROVIDER
PAYMENT_KEY_ID
PAYMENT_KEY_SECRET
OPENAI_API_KEY
```

## Product configuration

Keep these in `instance_configs`:

```text
features
terminology
branding
exam behavior
product settings
```

Do not move secrets into Mongo configuration.

---

# 24. Logging

Every backend log should include `INSTANCE_ID`.

For example:

```text
[examflex] PDF upload processing started
[examflex] Mock test generated
[ezprep] Question imported
```

With structured logging, prefer:

```json
{
  "instanceId": "examflex",
  "event": "pdf_processing_started",
  "jobId": "..."
}
```

This becomes extremely valuable once you operate dozens of instances.

---

# 25. Health Endpoint

Create:

```text
GET /health
```

It should report application health, not sensitive configuration.

Eventually return something like:

```json
{
  "status": "ok",
  "instanceId": "examflex",
  "version": "2.15.0"
}
```

You may also expose separate checks for:

- Mongo connectivity
- Redis connectivity
- queue worker status

Do not put credentials or connection strings into health responses.

---

# 26. Database Connection

The application code must never assume a hardcoded database name.

Current:

```env
MONGODB_URI=mongodb://localhost:27017/live
```

Production EZ Prep:

```env
MONGODB_URI=mongodb+srv://.../ezprep
```

Production ExamFlex:

```env
MONGODB_URI=mongodb+srv://.../examflex
```

Every environment gets its own URI.

Do not write:

```typescript
mongoose.connect(`${baseUri}/live`)
```

or similar.

The entire Mongo connection string comes from configuration.

---

# 27. Atlas Database Users

Do not use an Atlas administrator credential in application `.env`.

Application database users should have the minimum permissions required for the application.

The control-plane service, if it needs to administer multiple tenant databases, should use a separate privileged credential.

Conceptually:

```text
EzPrep API
  -> application credential
  -> ezprep database

ExamFlex API
  -> application credential
  -> examflex database

Control Plane
  -> privileged administration credential
  -> relevant tenant databases + platform database
```

As the customer count increases, tighten database roles and privileges further.

---

# 28. Create the Control Plane Database

Create:

```text
ezprep_platform
```

This is not a customer database.

Initial collection:

```text
deployments
```

Later:

```text
deployments
releases
deployment_events
plans
customers
domains
```

Example deployment document:

```json
{
  "_id": "examflex",
  "deploymentId": "examflex",
  "displayName": "ExamFlex",
  "environment": "production",
  "databaseName": "examflex",
  "currentVersion": "2.15.0",
  "desiredVersion": "2.15.0",
  "status": "healthy",
  "infrastructureTier": "standard",
  "backend": {
    "host": "..."
  },
  "frontend": {
    "vercelProjectId": "..."
  },
  "domains": {
    "web": "...",
    "api": "...",
    "admin": "..."
  },
  "createdAt": "...",
  "updatedAt": "..."
}
```

Do not store application secrets here.

---

# 29. Control Plane: What It Actually Does

The control plane is an internal administration application.

It is not another copy of the customer-facing product.

Its job is to answer:

```text
What instances exist?
Which version does each instance run?
Where is each instance hosted?
What database belongs to it?
What features/configuration does it have?
What is healthy/unhealthy?
What release should it receive?
```

At 2 instances, this can be extremely small.

At 100 instances, it becomes a valuable operational dashboard.

---

# 30. Initial Control Plane Dashboard

Target view:

```text
EZ PREP PLATFORM

Deployments

------------------------------------------------------------
Instance       Version    Desired    Status       Tier
------------------------------------------------------------
EZ Prep        2.15.0     2.15.0     Healthy      Standard
ExamFlex       2.15.0     2.15.0     Healthy      Standard
ABC Academy    2.14.7     2.15.0     Pending      Standard
XYZ Institute  2.15.0     2.15.0     Healthy      Enterprise
------------------------------------------------------------
```

Clicking an instance shows:

```text
Deployment
Environment
Version
Domains
Database
Feature configuration
Branding
Terminology
Redis/queue status
Last deployment
Last failed deployment
```

The control plane should not be exposed publicly to customers.

---

# 31. Configuration Management at 100 Clients

A good model is:

```text
Feature catalog in code
          +
default configuration in code
          +
per-instance overrides in MongoDB
          +
Redis cache
```

Example feature addition:

```text
Step 1:
Add Feature.ADVANCED_ANALYTICS

Step 2:
Default = false

Step 3:
Build the feature

Step 4:
Guard backend endpoint

Step 5:
Gate frontend

Step 6:
Turn on for selected clients via config
```

At 100 clients, dashboard should allow:

```text
Enable for:
[x] Client A
[x] Client B
[x] Client C
[ ] Client D
...
```

Eventually you can add rollout groups:

```text
standard
beta
enterprise
neet
state-government
```

Then new features can be rolled out to groups.

---

# 32. Global Feature vs Instance Feature

Not every feature needs a client-specific flag.

Use these categories:

## Product-wide permanent feature

No flag needed once universally available.

## Gradual rollout

Feature flag.

## Client-specific capability

Feature flag/configuration.

## Different behavior

Strategy/provider.

## Different text

Terminology.

## Different secrets

Environment/secret management.

This prevents configuration from becoming chaotic.

---

# 33. Avoid Feature Flag Explosion

Do not make flags for every tiny UI decision.

Good:

```text
advancedAnalytics
leaderboard
aiExplanations
```

Bad:

```text
showBlueButton
showNewTitle
showQuestionButtonV2
useNewHeaderPadding
...
```

For visual/UI changes, use normal code/design system improvements unless the business actually needs long-lived client-specific behavior.

Feature flags should generally represent meaningful product capabilities or rollout controls.

---

# 34. Deployment Versioning

The application should have a version.

Example:

```text
2.15.0
```

Initially, GitHub Actions can derive this from Git tags or another consistent release/version process.

Eventually:

```text
release 2.15.0
  |
  +--> EzPrep
  +--> ExamFlex
  +--> Client A
  +--> Client B
```

The same artifact should be used everywhere.

Do not rebuild different code for each client.

---

# 35. Normal Release Workflow

Desired future workflow:

```text
Developer
   |
Pull Request
   |
Tests
   |
Merge -> main
   |
Build release
   |
Deploy EZ Prep
   |
Deploy ExamFlex
```

For a future 100-client environment:

```text
main
  |
build once
  |
release artifact
  |
deployment manager
  |
+-- Client A
+-- Client B
+-- Client C
...
+-- Client 100
```

---

# 36. Current GitHub Actions: Deploy Both Backends

You currently have:

```text
GitHub Actions
 -> SSH
 -> DO Droplet
 -> PM2
```

Keep this for now.

Change the workflow so a push to `main` runs:

```text
Deploy EzPrep
Deploy ExamFlex
```

Use two independent sets of secrets:

```text
EZPREP_HOST
EZPREP_USER
EZPREP_DEPLOY_KEY
EZPREP_DEPLOY_PATH

EXAMFLEX_HOST
EXAMFLEX_USER
EXAMFLEX_DEPLOY_KEY
EXAMFLEX_DEPLOY_PATH
```

Each server has its own runtime `.env`.

The CI workflow should not contain application secrets such as Mongo passwords or payment secrets unless strictly necessary.

---

# 37. Add Manual Deployment Capability

Modify the GitHub Actions workflow to support `workflow_dispatch`.

Desired parameters:

```text
target:
  all
  ezprep
  examflex

ref:
  main / tag / commit
```

Normal behavior:

```text
push main
 -> target=all
```

Emergency behavior:

```text
manual workflow
 -> target=examflex
 -> ref=specific release
```

This gives you a primitive deployment manager before building a proper control plane.

---

# 38. Future Client-Specific Release

Suppose a feature is only for ABC.

Preferred:

```text
Build feature in main
        |
Deploy same version to all
        |
ABC config:
  feature=true

Others:
  feature=false
```

Only when a customer genuinely needs a different code version:

```text
ABC -> version 2.16.0
Others -> version 2.15.0
```

Your deployment metadata tracks the divergence.

Do not create a permanent customer Git branch unless absolutely unavoidable.

---

# 39. DigitalOcean: Clone the Current Droplet

The current server has:

- backend
- PM2
- Nginx
- deployment setup

and MongoDB is external in Atlas, so cloning the application server is appropriate.

DigitalOcean Droplet snapshots are disk images and can be used to create another Droplet with the same disk contents. Snapshot metadata such as the old Droplet's IP is not copied.

## Important behavior

A newly created Droplet from a snapshot is a real running server.

Do not assume you will get a long configuration-only window before services start.

Because the snapshot can contain your PM2/Nginx/systemd configuration, services may start automatically when the cloned server boots.

Therefore, prepare the snapshot so the application is not serving production traffic when the clone comes online.

---

# 40. Safest Clone Procedure for Your Current Setup

## Step 40.1: Record the current server state

On current EZ Prep server:

```bash
hostname
node -v
npm -v
pm2 -v
pm2 status
nginx -t
```

Also record:

```bash
pm2 startup
pm2 save
```

and inspect your PM2 ecosystem configuration if you have one.

Back up important Nginx configuration:

```bash
sudo cp -a /etc/nginx /root/nginx-backup-before-clone
```

Back up the current `.env` somewhere safe.

Do not commit it to Git.

## Step 40.2: Stop application processes before snapshot

Because MongoDB is external, there is no database process on the application server that needs to be snapshotted.

On the EZ Prep server:

```bash
pm2 stop all
pm2 save
```

This is temporary and is only to make the clone boot in a non-serving state.

Take the snapshot.

After the snapshot has completed, restore production:

```bash
pm2 start all
pm2 save
```

Confirm:

```bash
pm2 status
```

and test the original application.

## Step 40.3: Create the DigitalOcean snapshot

In the DigitalOcean Control Panel:

```text
Droplet
 -> Snapshots
 -> Take Snapshot
```

Name it something explicit, for example:

```text
ezprep-app-server-template-2026-09
```

Wait until the snapshot is complete.

Do not delete the original server.

## Step 40.4: Create the ExamFlex Droplet from the snapshot

DigitalOcean:

```text
Create
 -> Droplets
 -> Choose Image
 -> Snapshots
 -> select the snapshot
```

Choose:

- desired region
- equal or larger disk than source Droplet
- desired Droplet size
- monitoring/backups if appropriate
- SSH authentication

DigitalOcean permits creating a Droplet from a snapshot and separately selecting SSH keys at Droplet creation.

Do not reuse the old production IP; the new Droplet will receive its own IP.

---

# 41. SSH Key Safety on the Cloned Droplet

The snapshot contains the source disk, so files such as:

```text
/root/.ssh/authorized_keys
```

may exist in the snapshot.

At the same time, DigitalOcean allows SSH keys to be attached when creating the new Droplet.

Do not rely on the clone inheriting exactly the keys you expect.

Recommended approach:

1. Add the intended new ExamFlex public key during Droplet creation.
2. Boot the new server.
3. Test SSH access using that key.
4. Inspect:

```bash
sudo cat /root/.ssh/authorized_keys
```

5. Remove any obsolete key that should not be trusted on the ExamFlex server.
6. Verify the new key works from a fresh terminal/session before closing the old one.

Do not delete the old working key until the new key is verified.

For GitHub Actions, preferably use a deployment SSH key dedicated to the server/deployment rather than using your personal laptop key.

Root + SSH keys is acceptable for the current stage if you understand the risk, but later introduce a dedicated non-root deployment user and least-privilege sudo permissions.

---

# 42. Immediately After ExamFlex Droplet Creation

Before changing DNS, log into the new Droplet:

```bash
ssh root@<EXAMFLEX_IP>
```

Check:

```bash
hostname
ip addr
node -v
npm -v
pm2 -v
pm2 status
```

The application should ideally be stopped because of the snapshot preparation.

If it is running:

```bash
pm2 stop all
```

Do not point the ExamFlex domain to this IP yet.

---

# 43. Change the Hostname

Set:

```bash
hostnamectl set-hostname examflex-api
```

Then verify:

```bash
hostname
```

This helps prevent confusion when both servers look similar.

---

# 44. Replace the Environment File

On the cloned server:

```text
/your/app/path/.env
```

Make a copy first:

```bash
cp .env .env.clone-backup
```

Then update:

```env
INSTANCE_ID=examflex
INSTANCE_NAME=ExamFlex

MONGODB_URI=<ATLAS_URI_TO_examflex>

REDIS_URL=<SHARED_UPSTASH_REDIS>

S3_KEY_PREFIX=examflex

CORS_ORIGINS=https://examflex.example.com,https://admin.examflex.example.com

PUBLIC_WEB_URL=https://examflex.example.com
PUBLIC_API_URL=https://api.examflex.example.com

PAYMENT_PROVIDER=...
PAYMENT_KEY_ID=...
PAYMENT_KEY_SECRET=...
```

Keep all actual secrets out of Git.

Do not copy EZ Prep's payment secret into ExamFlex.

---

# 45. PM2 Names

Your cloned PM2 configuration may still have names such as:

```text
ezprep-api
```

Change them to:

```text
examflex-api
```

If your PM2 ecosystem configuration uses environment variables, prefer:

```javascript
name: `${process.env.INSTANCE_ID}-api`
```

Then the same PM2 configuration works on both servers.

Restart:

```bash
pm2 start ...
pm2 save
```

Verify:

```bash
pm2 status
```

---

# 46. Nginx Configuration on ExamFlex

The cloned Nginx configuration may still contain:

```text
server_name api.ezprep...
```

Do not leave that on ExamFlex.

Create an ExamFlex server block such as:

```nginx
server {
    server_name api.examflex.example.com;

    location / {
        proxy_pass http://127.0.0.1:<YOUR_NEST_PORT>;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Use your actual NestJS port.

Then:

```bash
nginx -t
systemctl reload nginx
```

Do not copy EZ Prep's SSL certificate and simply assume it is valid for ExamFlex.

After DNS is pointed correctly, issue a new certificate for the ExamFlex domain using your existing certificate-management process (for example Certbot if that is what your current server uses).

---

# 47. DNS for ExamFlex API

Suppose:

```text
ExamFlex frontend:
https://examflex.example.com

ExamFlex API:
https://api.examflex.example.com
```

Create the DNS record required by your DNS provider, for example:

```text
api.examflex.example.com -> EXAMFLEX_DROPLET_IP
```

Wait for DNS resolution.

Then verify:

```bash
dig api.examflex.example.com
```

or:

```bash
nslookup api.examflex.example.com
```

Only after it resolves to the new server should you issue the SSL certificate.

---

# 48. Verify ExamFlex Backend Before Vercel

First test directly:

```text
http://<EXAMFLEX_IP>:<PORT>
```

if the port is safely reachable, or preferably through Nginx/HTTP once configured.

Then:

```text
https://api.examflex.example.com/health
```

Confirm:

```json
{
  "status": "ok",
  "instanceId": "examflex"
}
```

Also inspect logs:

```bash
pm2 logs
```

---

# 49. Vercel Architecture for EZ Prep + ExamFlex

You said the frontend is currently on Vercel.

Create two separate Vercel Projects:

```text
EZ Prep Web
ExamFlex Web
```

Both projects can use the same Git repository/codebase.

Example:

```text
GitHub repository
        |
        +---- Vercel project: ezprep-web
        |
        +---- Vercel project: examflex-web
```

Each project has its own environment variables and production domain.

Each commit to the connected production branch can trigger deployments for the connected projects.

---

# 50. Vercel Project Configuration

## EZ Prep project

Environment:

```env
NEXT_PUBLIC_INSTANCE_ID=ezprep
NEXT_PUBLIC_API_URL=https://api.ezprep.example.com
```

and any other existing frontend configuration.

## ExamFlex project

```env
NEXT_PUBLIC_INSTANCE_ID=examflex
NEXT_PUBLIC_API_URL=https://api.examflex.example.com
```

Do not put secrets into variables exposed to the browser.

Anything starting with `NEXT_PUBLIC_` should be treated as browser-visible.

---

# 51. Vercel Environment Variables

Remember:

Changing a Vercel environment variable does not modify old deployments. The new value is used by future deployments.

So after changing a production variable:

```text
Save variable
   |
Redeploy
```

Do not assume an old deployment automatically receives the new value.

For production, explicitly verify:

```text
Vercel Project
 -> Settings
 -> Environment Variables
 -> Production
```

---

# 52. Vercel Domains

For the ExamFlex project:

```text
Project
 -> Settings
 -> Domains
 -> Add Domain
```

Add:

```text
examflex.example.com
```

and configure DNS according to Vercel's instructions.

Vercel automatically provisions SSL after successful domain verification.

Do the equivalent for EZ Prep if/when its domain needs to change.

---

# 53. Vercel + Same Repository

Do not duplicate the frontend source code.

Both projects should point to the same repository and application/root directory.

Conceptually:

```text
Same Next.js source

EZ Prep Vercel project
  env -> INSTANCE_ID=ezprep

ExamFlex Vercel project
  env -> INSTANCE_ID=examflex
```

This is the frontend equivalent of:

```text
Same NestJS source

EZ Prep Droplet
  env -> INSTANCE_ID=ezprep

ExamFlex Droplet
  env -> INSTANCE_ID=examflex
```

---

# 54. Frontend Config Should Prefer API-Supplied Product Configuration

Do not put this in Vercel environment variables:

```env
SHOW_LEADERBOARD=true
TERM_SUBJECT=Chapter
```

unless there is a specific build-time reason.

Instead:

```text
Next.js
   |
   v
GET /api/v1/instance/config
   |
NestJS
   |
instance_configs in the correct Mongo DB
   |
Redis cache
```

That means you can change a label or enable a feature without rebuilding the frontend.

The Vercel env only needs to identify/locate the backend:

```env
NEXT_PUBLIC_INSTANCE_ID=examflex
NEXT_PUBLIC_API_URL=https://api.examflex.example.com
```

---

# 55. Authentication and Sessions

Current authentication is application + MongoDB.

Future target:

```text
Frontend
   |
   v
NestJS
   |
Redis session/cache
```

For each instance:

```text
ezprep:session:...
examflex:session:...
```

MongoDB remains the source of truth for users and persistent authentication data where appropriate.

Redis handles ephemeral/session state.

When you scale the API to:

```text
3 API replicas
```

all replicas use the same Redis instance/namespace:

```text
examflex:*
```

Therefore:

```text
Load Balancer
     |
+----+----+
|    |    |
API1 API2 API3
 \    |   /
   Redis
```

Any replica can serve the next request.

---

# 56. BullMQ

When PDF ingestion is introduced:

```text
ExamFlex API
    |
create job
    |
examflex:pdf-processing
    |
Redis
    |
worker
```

EZ Prep:

```text
ezprep:pdf-processing
```

This prevents one application from consuming another application's queue jobs.

Workers should also have:

```env
INSTANCE_ID=examflex
REDIS_URL=...
```

and use the same queue naming convention.

---

# 57. Future Horizontal Scaling

Today:

```text
1 instance
1 Droplet
1 API process
```

Later:

```text
1 instance
1 Load Balancer
3 API replicas
```

The API must be stateless so any replica can handle any request.

Example:

```text
ExamFlex Load Balancer
        |
   +----+----+
   |    |    |
 API1 API2 API3
   \    |    /
      Redis
        |
     MongoDB
```

At this point PM2 may still manage multiple processes on one machine, but eventually containers/Kubernetes become more useful.

---

# 58. Docker

Do not block today's migration waiting for Docker.

Current:

```text
PM2 + Nginx
```

is sufficient.

However, make the application easy to containerize:

- deterministic builds
- no reliance on local files
- all configuration through environment
- stateless process
- explicit start command
- health endpoint

Later:

```text
PM2
  -> Docker
  -> Kubernetes
```

The application itself should not need redesigning.

---

# 59. GitHub Actions: Immediate Structure

Conceptually:

```yaml
on:
  push:
    branches:
      - main

jobs:
  deploy-ezprep:
    ...

  deploy-examflex:
    ...
```

Each job:

```text
SSH
 -> cd application
 -> git fetch/pull
 -> install dependencies
 -> build
 -> restart PM2
 -> health check
```

Use deployment-specific paths and secrets.

For example:

```text
/var/www/ezprep-api
/var/www/examflex-api
```

Do not use a single shared path.

---

# 60. Deployment Health Checks

Do not consider:

```bash
pm2 restart app
```

a successful deployment by itself.

After deployment:

```bash
curl -f https://api.example.com/health
```

Then only mark the deployment successful if the health endpoint responds correctly.

For both apps:

```text
Deploy
 -> restart
 -> wait
 -> health check
 -> fail if unhealthy
```

At 100 clients, the deployment platform can use exactly the same health check.

---

# 61. GitHub Actions Rollback Philosophy

Every deployment should be tied to a known commit/version.

If a release breaks:

```text
current -> v2.15.0
previous -> v2.14.3
```

Roll back to the known-good version.

Do not use:

```bash
git pull origin main
```

as the only conceptual deployment mechanism forever.

For now it is acceptable, but make the workflow version-aware so later you can build immutable artifacts.

---

# 62. Long-Term Deployment Manager

Do not build Kubernetes yet.

Later, the system becomes:

```text
GitHub
  |
build release once
  |
artifact/container registry
  |
Control Plane
  |
Deployment Manager
  |
+-- client A
+-- client B
+-- client C
...
```

Each deployment record stores:

```text
desiredVersion
currentVersion
status
```

Then an all-client release is:

```text
release v2.20.0

target:
all active production deployments
```

The manager rolls it out progressively.

---

# 63. Canary / Progressive Releases

At 100 clients, don't blindly release to all 100 simultaneously.

Recommended:

```text
v2.20.0
   |
   +--> internal/test
   |
   +--> 5 clients
   |
   +--> 25 clients
   |
   +--> remaining clients
```

After each batch:

- health checks
- error rate
- latency
- application logs
- queue health

If a release fails, stop rollout.

---

# 64. Database Migrations Across Multiple Clients

Every application release that changes data structure needs a migration strategy.

Use backward-compatible migrations where possible.

Preferred:

```text
Step 1: add new field/index
Step 2: deploy code that can understand old + new data
Step 3: backfill
Step 4: start relying on new data
Step 5: remove old structure later
```

Do not deploy a new app that immediately assumes the database has already been destructively changed.

At 100 clients, track the database migration/version per deployment.

---

# 65. Instance Database Bootstrap

Create a repeatable command/script:

```bash
npm run instance:bootstrap
```

It should:

1. Read `INSTANCE_ID`.
2. Connect to the configured MongoDB database.
3. Create required collections/indexes if absent.
4. Create/update the singleton instance configuration.
5. Optionally verify expected indexes.
6. Exit successfully.

Then provisioning a new client becomes:

```text
Create database
   |
Set MONGODB_URI
   |
npm run instance:bootstrap
   |
deploy application
```

Do not require manually remembering which indexes or seed documents need to be created.

---

# 66. Add Configuration Validation

On application startup, validate environment variables.

Required examples:

```text
INSTANCE_ID
MONGODB_URI
REDIS_URL
AWS_REGION
AWS_S3_BUCKET
AWS_S3_IMAGE_BUCKET
CORS_ORIGINS
```

Fail fast if missing.

Use a proper configuration validation library or NestJS configuration validation.

Bad:

```text
app starts with undefined Mongo URI
```

Good:

```text
application refuses to start and clearly says:
MONGODB_URI is required
```

---

# 67. Configuration Access Pattern

Do not access `process.env` throughout the application.

Bad:

```typescript
process.env.MONGODB_URI
process.env.REDIS_URL
process.env.INSTANCE_ID
```

from hundreds of files.

Prefer:

```text
ConfigModule
  |
typed config providers
  |
services/modules
```

Examples:

```typescript
configService.getOrThrow<string>("INSTANCE_ID")
```

or typed wrappers:

```typescript
appConfig.instanceId
redisConfig.url
awsConfig.bucket
paymentConfig.provider
```

This keeps infrastructure configuration centralized.

---

# 68. Instance-Aware S3 Service

Do not let each feature build S3 paths manually.

Create:

```text
StorageService
```

with methods such as:

```typescript
getQuestionImageKey(questionId)
getUploadKey(uploadId)
```

The implementation adds:

```text
${INSTANCE_ID}/...
```

automatically.

Then application code remains:

```typescript
storageService.uploadQuestionImage(...)
```

rather than manually composing:

```text
examflex/questions/...
```

---

# 69. Instance-Aware Redis Service

Similarly, create a Redis key builder:

```typescript
key("session", sessionId)
key("cache", "question", questionId)
key("config", "instance")
```

which automatically produces:

```text
examflex:session:...
examflex:cache:question:...
examflex:config:instance
```

This avoids developers forgetting the prefix.

---

# 70. Instance-Aware Queue Service

Create a queue naming helper:

```typescript
queueName("pdf-processing")
```

which generates:

```text
examflex:pdf-processing
```

and:

```text
ezprep:pdf-processing
```

Workers use the same helper.

Never manually type queue names in random files.

---

# 71. Frontend Architecture Summary

Create:

```text
src/
  config/
  context/
    InstanceConfigProvider.tsx
  hooks/
    useFeature.ts
    useTerminology.ts
  components/
    FeatureGate.tsx
```

Application bootstrap:

```text
load safe instance config
      |
InstanceConfigProvider
      |
+------------------------------+
|              |               |
features   terminology      branding
```

Then pages consume the configuration.

---

# 72. Backend Architecture Summary

Create:

```text
src/
  instance/
    instance.module.ts
    instance-config.service.ts
    instance-config.repository.ts
    feature.service.ts
    terminology.service.ts
    feature.guard.ts
    feature.decorator.ts
    instance.types.ts
    instance.defaults.ts
    feature.enum.ts
```

Business modules should depend on these services/interfaces rather than directly querying environment variables or client identity.

---

# 73. Special Business Logic

When requirements differ significantly, use patterns.

Example:

```text
EvaluationService
      |
      +-- StandardEvaluationStrategy
      +-- NegativeMarkingStrategy
      +-- NeetEvaluationStrategy
```

Choose strategy based on resolved product configuration.

Likewise:

```text
PaymentService
      |
      +-- RazorpayProvider
      +-- StripeProvider
```

and:

```text
NotificationService
      |
      +-- EmailProvider
      +-- WhatsAppProvider
```

This keeps conditionals localized.

---

# 74. When an `if` is Fine

Not every `if` is bad.

This is fine:

```typescript
if (featureService.isEnabled(Feature.LEADERBOARD)) {
  ...
}
```

It becomes bad when you have:

```typescript
if (instance === "ezprep") ...
if (instance === "examflex") ...
if (instance === "abc") ...
if (instance === "xyz") ...
```

throughout the business logic.

The rule is:

> Branch on capability/configuration, not on customer names.

---

# 75. Example: Adding AI Explanations

Implementation:

```text
1. Add Feature.AI_EXPLANATIONS
2. Default false
3. Build backend service
4. Add backend FeatureGuard
5. Add frontend FeatureGate
6. Add UI
7. Turn on in selected instance configuration
```

EZ Prep:

```json
{
  "features": {
    "aiExplanations": true
  }
}
```

ExamFlex:

```json
{
  "features": {
    "aiExplanations": false
  }
}
```

No separate codebase.

---

# 76. Example: New Terminology

New requirement:

```text
EZ Prep -> Subject
ExamFlex -> Chapter
```

Store:

EZ Prep:

```json
{
  "terminology": {
    "subject": "Subject"
  }
}
```

ExamFlex:

```json
{
  "terminology": {
    "subject": "Chapter"
  }
}
```

Frontend:

```tsx
{terminology.subject}
```

Backend:

```typescript
terminologyService.get("subject")
```

No application branching by instance.

---

# 77. Example: New Payment Account

EzPrep:

```env
PAYMENT_ACCOUNT_ID=ezprep
```

ExamFlex:

```env
PAYMENT_ACCOUNT_ID=examflex
```

Business code remains:

```typescript
paymentService.createOrder(...)
```

Do not put merchant logic in controllers.

---

# 78. White-Label Client Lifecycle

Long-term provisioning flow:

```text
Create Customer
      |
Create Deployment record
      |
Create client database
      |
Create/assign database credentials
      |
Bootstrap indexes/config
      |
Create Redis namespace
      |
Create S3 prefix
      |
Create DNS/domain
      |
Provision application deployment
      |
Run health checks
      |
Mark deployment active
```

This workflow can eventually become a single button in your control plane.

---

# 79. Shared vs Dedicated Infrastructure

Do not make physical isolation the definition of a customer.

A deployment can start:

```text
1 Droplet
```

then become:

```text
3 API replicas + Load Balancer
```

then become:

```text
Kubernetes workload
```

then:

```text
Dedicated infrastructure
```

without changing:

```text
deploymentId
database
configuration model
application code
```

This is the important abstraction.

---

# 80. Future 100-Client Architecture

```text
                         EZ PREP PLATFORM
                              |
                   +----------+-----------+
                   |                      |
              Control Plane          Release System
                   |                      |
                   +----------+-----------+
                              |
                    Deployment Registry
                              |
        +---------------------+----------------------+
        |            |             |                  |
      Client A     Client B      Client C          Client 100
        |            |             |                  |
     version 21   version 21    version 20         version 21
        |            |             |                  |
        v            v             v                  v
    deployment   deployment    deployment         deployment
        |            |             |                  |
        +------------+-------------+------------------+
                         Infrastructure
```

Applications remain isolated logically.

Infrastructure can be shared or dedicated.

---

# 81. Immediate Implementation Order

Do these in this exact order.

## Phase 1: Safety / preparation

1. Take MongoDB backup.
2. Record the current production Droplet configuration.
3. Verify current GitHub Actions deployment works.
4. Verify you can SSH into the current Droplet manually.
5. Verify you know where the PM2 ecosystem/configuration lives.
6. Verify the current Nginx configuration and domain configuration.
7. Verify AWS/S3 configuration.

## Phase 2: MongoDB migration

8. Clone `live` -> `ezprep`.
9. Verify collection counts.
10. Verify indexes.
11. Verify representative production data.
12. Update EzPrep `MONGODB_URI` from `/live` -> `/ezprep`.
13. Deploy and verify application.
14. Keep `live` untouched for the safety window.
15. Delete `live` only after final verification.

## Phase 3: Create ExamFlex database

16. Create `examflex`.
17. Create `instance_configs`.
18. Insert ExamFlex singleton configuration.
19. Verify application database/index bootstrap strategy.

## Phase 4: Backend instance-awareness

20. Add `INSTANCE_ID`.
21. Centralize environment configuration.
22. Add `InstanceConfigService`.
23. Add default configuration.
24. Add MongoDB `instance_configs` repository.
25. Add Redis-backed configuration caching.
26. Add feature enum/service.
27. Add backend feature guard/decorator.
28. Add terminology service.
29. Add `/api/v1/instance/config` public-safe configuration endpoint.
30. Add `INSTANCE_ID` to logs.
31. Add health endpoint.

## Phase 5: Redis separation

32. Create shared Upstash Redis configuration.
33. Add instance-aware Redis key builder.
34. Prefix all session keys.
35. Prefix all cache keys.
36. Prefix configuration cache.
37. Prefix all future BullMQ queues.
38. Ensure no unscoped Redis keys remain.
39. Ensure no maintenance script can accidentally `FLUSHDB`.

## Phase 6: S3 separation

40. Add `S3_KEY_PREFIX`.
41. Set `ezprep` for EZ Prep.
42. Set `examflex` for ExamFlex.
43. Update all object key creation through `StorageService`.
44. Verify old EzPrep objects remain accessible.
45. Verify ExamFlex cannot accidentally generate EZ Prep-prefixed objects.

## Phase 7: Frontend configuration

46. Create Vercel ExamFlex project.
47. Point it to the same repository.
48. Configure ExamFlex production environment variables.
49. Add ExamFlex domain.
50. Set API URL to ExamFlex backend.
51. Add `InstanceConfigProvider`.
52. Add `useFeature`.
53. Add `FeatureGate`.
54. Add `useTerminology`.
55. Replace hardcoded product labels where needed.
56. Replace instance-name conditionals with capabilities/configuration.

## Phase 8: DigitalOcean ExamFlex

57. Stop PM2 on EZ Prep temporarily.
58. Save stopped state.
59. Create Droplet snapshot.
60. Restore EZ Prep PM2 processes.
61. Verify EZ Prep remains healthy.
62. Create new Droplet from snapshot.
63. Attach/test ExamFlex SSH key.
64. Remove obsolete cloned SSH keys after new access is verified.
65. Change hostname to `examflex-api`.
66. Stop any accidentally started cloned application processes.
67. Replace `.env`.
68. Set `INSTANCE_ID=examflex`.
69. Set ExamFlex Mongo URI.
70. Set shared Redis URI.
71. Set `S3_KEY_PREFIX=examflex`.
72. Set ExamFlex CORS.
73. Update PM2 process names/config.
74. Update Nginx `server_name`.
75. Point ExamFlex API DNS to the new IP.
76. Obtain/verify ExamFlex SSL certificate.
77. Start PM2.
78. Run `/health`.
79. Verify logs.
80. Test ExamFlex API against `examflex` MongoDB.

## Phase 9: CI/CD

81. Add ExamFlex GitHub Actions deployment target.
82. Keep EzPrep deployment target.
83. Make `main` deploy both.
84. Add health checks after each deployment.
85. Add manual `workflow_dispatch`.
86. Add `target=all|ezprep|examflex`.
87. Add release/version tracking.
88. Keep secrets per deployment.

## Phase 10: Control plane

89. Create `ezprep_platform`.
90. Create `deployments`.
91. Record EzPrep and ExamFlex.
92. Build small internal admin dashboard.
93. Show version/status/domain/database metadata.
94. Add configuration-management screens.
95. Allow feature toggles.
96. Allow terminology editing.
97. Add audit history for configuration changes.
98. Later add automated provisioning.

---

# 82. Verification Checklist for EzPrep Migration

Before deleting `live`, verify:

```text
[ ] Atlas backup exists
[ ] ezprep database exists
[ ] all expected collections exist
[ ] collection counts match
[ ] indexes match
[ ] representative questions exist
[ ] representative users exist
[ ] exams work
[ ] mock tests work
[ ] attempts work
[ ] OTP/session flow works
[ ] uploads work
[ ] image URLs work
[ ] S3 objects remain accessible
[ ] application writes go to ezprep
[ ] no application code references database name "live"
[ ] GitHub Actions uses updated server env
[ ] Redis keys are unchanged/verified
[ ] frontend is working
[ ] admin is working
[ ] no production errors observed
```

Only then:

```text
drop live
```

---

# 83. Search the Codebase for Hardcoded Instance Assumptions

Before calling the refactor complete, search for:

```text
live
ezprep
examflex
localhost:27017
api.ezprep
ezprep.com
examflex.com
CORS
razorpay
stripe
AWS_S3_BUCKET
AWS_S3_IMAGE_BUCKET
Redis keys
BullMQ queue names
```

The source code should not contain unnecessary assumptions that one deployment is EZ Prep.

A good search result is:

```text
INSTANCE_ID
CORS_ORIGINS
MONGODB_URI
REDIS_URL
S3_KEY_PREFIX
FeatureService
TerminologyService
PaymentService
```

rather than:

```text
if (isExamFlex)
if (isEzPrep)
```

all over the codebase.

---

# 84. Copilot Guidance

When using GitHub Copilot, give it small, bounded tasks.

Good prompt:

> Create an `InstanceConfigModule` for NestJS. The module must load a singleton document `_id=singleton` from the `instance_configs` collection for the current deployment, merge it with typed defaults, and cache the resolved configuration in Redis using the key `<INSTANCE_ID>:config:instance`. Do not access `process.env` outside the configuration module. Include unit tests.

Another:

> Create a NestJS `FeatureGuard` and `@Feature()` decorator. Feature definitions must use a typed enum. The guard must call `FeatureService.isEnabled()` and reject disabled features. Do not add any instance-name conditionals.

Another:

> Create a React `FeatureGate` component and `useFeature()` hook. Feature configuration comes from the `/api/v1/instance/config` endpoint via a provider/context. Do not use `INSTANCE_ID` checks in components.

Keep changes modular.

---

# 85. Recommended First Coding Commit

Before doing broad feature refactoring, introduce:

```text
INSTANCE_ID
INSTANCE_NAME
```

and central configuration.

Then add:

```text
InstanceConfigService
```

Then:

```text
FeatureService
TerminologyService
```

Then migrate existing code incrementally.

Do not rewrite the entire application in one giant change.

---

# 86. Recommended First Data Model

### In each instance DB

```text
instance_configs
  document:
    _id = singleton
    schemaVersion
    instanceId
    displayName
    features
    terminology
    branding
    product
    updatedAt
    updatedBy
```

### In platform DB

```text
deployments
  document:
    deploymentId
    displayName
    databaseName
    environment
    currentVersion
    desiredVersion
    infrastructureTier
    domains
    status
    frontendProjectId
    createdAt
    updatedAt
```

Do not duplicate secrets.

---

# 87. Recommended Long-Term Data Flow

Normal customer request:

```text
Browser
   |
   v
Vercel frontend
   |
   v
Instance API
   |
   +------> MongoDB instance DB
   |
   +------> Redis instance namespace
   |
   +------> S3 instance prefix
   |
   +------> BullMQ instance queue
```

Configuration:

```text
Admin dashboard
   |
   v
Instance config service
   |
   v
instance_configs in customer DB
   |
   v
invalidate Redis config cache
```

Deployment:

```text
GitHub
   |
   v
GitHub Actions
   |
   +--> EZ Prep server
   |
   +--> ExamFlex server
```

Future:

```text
GitHub
   |
   v
Release artifact
   |
   v
Control Plane / Deployment Manager
   |
   +--> client A
   +--> client B
   +--> client C
   ...
```

---

# 88. What Not to Build Yet

Do NOT block the current ExamFlex launch on:

- Kubernetes
- Terraform
- Docker registry
- service mesh
- complex service discovery
- a huge control-plane product
- per-client Mongo clusters
- 100-client rollout automation

The correct immediate abstraction is:

```text
same code
+
different environment/config
+
different database
+
different runtime instance
```

The advanced platform comes later.

---

# 89. Current Architecture Is Intentionally Simple

For two applications:

```text
EzPrep
  DO server
  MongoDB database: ezprep
  Redis namespace: ezprep:*
  S3 prefix: ezprep/
  Vercel project: ezprep-web

ExamFlex
  DO server
  MongoDB database: examflex
  Redis namespace: examflex:*
  S3 prefix: examflex/
  Vercel project: examflex-web
```

This is enough.

When you add a third client:

```text
Client A
  DO deployment
  MongoDB database: client_a
  Redis namespace: client_a:*
  S3 prefix: client_a/
```

The code does not change.

Only provisioning/configuration changes.

---

# 90. Final Architecture Rule Set

Keep these as the long-term rules for EZ Prep:

```text
ONE REPOSITORY
ONE CODEBASE
ONE RELEASE ARTIFACT

MANY DEPLOYMENTS
MANY DOMAINS
MANY DATABASES
MANY CONFIGURATIONS

NO CUSTOMER CODE FORKS BY DEFAULT

DATABASE PER DEPLOYMENT
SHARED MONGODB CLUSTER INITIALLY

REDIS NAMESPACE PER DEPLOYMENT
S3 PREFIX PER DEPLOYMENT

FEATURES = FEATURE FLAGS
TEXT = TERMINOLOGY CONFIG
BEHAVIOR = STRATEGY / PROVIDER
SECRETS = ENV / SECRET MANAGEMENT

CONTROL PLANE = OPERATIONAL METADATA
CUSTOMER DB = CUSTOMER DATA + RUNTIME INSTANCE CONFIG

APPLICATIONS ARE STATELESS

DEPLOYMENTS ARE REPRODUCIBLE

MAIN -> STANDARD RELEASE TO ALL INSTANCES

MANUAL TARGETED DEPLOYMENTS FOR EXCEPTIONS

PHYSICAL INFRASTRUCTURE CAN CHANGE
WITHOUT CHANGING THE DEPLOYMENT MODEL
```

---

# 91. Definition of "Done" for the Immediate Migration

The migration is complete when:

```text
EZ PREP
    |
    +-- API on Droplet A
    +-- frontend on Vercel
    +-- Mongo -> ezprep
    +-- Redis -> ezprep:* namespace
    +-- S3 -> ezprep/* prefix


EXAMFLEX
    |
    +-- API on Droplet B
    +-- frontend on Vercel
    +-- Mongo -> examflex
    +-- Redis -> examflex:* namespace
    +-- S3 -> examflex/* prefix


SHARED
    |
    +-- same codebase
    +-- same GitHub repository
    +-- same MongoDB Atlas cluster
    +-- same Upstash Redis database
    +-- same S3 buckets
    +-- same CI/CD workflow
```

and:

```text
git push main
    |
    +--> EzPrep deploy
    |
    +--> ExamFlex deploy
```

with no client-specific code change.

---

# 92. Vendor References / Current Documentation

DigitalOcean:

- Droplet snapshots: https://docs.digitalocean.com/products/snapshots/how-to/snapshot-droplets/
- Create/restore Droplets from snapshots: https://docs.digitalocean.com/products/snapshots/how-to/create-and-restore-droplets/
- Create Droplets: https://docs.digitalocean.com/products/droplets/how-to/create/

MongoDB Atlas:

- Create/View/Drop databases: https://www.mongodb.com/docs/atlas/atlas-ui/databases/
- MongoDB databases and collections: https://www.mongodb.com/docs/v8.0/core/databases-and-collections/
- Atlas database users: https://www.mongodb.com/docs/atlas/security-add-mongodb-users/
- Atlas custom roles: https://www.mongodb.com/docs/atlas/security-add-mongodb-roles/

Vercel:

- Environment variables: https://vercel.com/docs/environment-variables
- Managing environment variables: https://vercel.com/docs/environment-variables/manage-across-environments
- Custom domains: https://vercel.com/docs/domains/set-up-custom-domain
- Monorepos / multiple projects from one repository: https://vercel.com/docs/monorepos
- Deploy Hooks: https://vercel.com/docs/deploy-hooks

---

# 93. The One-Sentence Mental Model

**EZ Prep is one software product that can be instantiated many times; each instance gets its own configuration, database, cache/queue namespace, storage namespace, domain and infrastructure, while all instances continue to run the same application code and releases.**
