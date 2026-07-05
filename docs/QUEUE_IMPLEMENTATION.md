# Queue Plan (Discussion Only — Not Implemented Yet)

You don't need heavy infrastructure to get started. Here's a practical progression that scales with the application's needs.

---

## Phase 1 — In-Process Background Processing (Current MVP)

### Flow

```text
POST /enrich
      │
      ▼
Save upload with status = processing
      │
      ▼
void backgroundPromise()
      │
      ▼
Background enrichment continues
```

### Pros

- ✅ Zero new dependencies
- ✅ Works with the current architecture
- ✅ Server continues processing even if the client refreshes or disconnects
- ✅ Fastest way to ship the MVP

### Cons

- ❌ Job is lost if the Node.js process restarts (upload remains stuck in `processing`)
- ❌ No coordination across multiple API instances
- ❌ No visibility into chunk-level progress

**Best suited for:** Single-server development, staging, and early production deployments.

---

## Phase 2 — MongoDB + Redis Job Queue (Recommended Next Step)

Use **BullMQ + Redis** (or `@nestjs/bull`).

### Flow

```text
POST /enrich
      │
      ▼
Enqueue BullMQ Job
      │
      ▼
Return HTTP 202 Accepted
      │
      ▼
Worker consumes job
      │
      ▼
Update upload status
```

### Additional Improvements

- Store the `jobId` on the upload document.
- On worker startup, optionally recover stale jobs:

```text
status = processing
AND
updatedAt > 30 minutes ago

↓

Re-queue the job
OR

Mark it as failed
```

### Infrastructure

Only a single Redis instance is required.

Examples:

- Railway Redis
- AWS ElastiCache
- Upstash Redis

**Estimated Cost:** ~$5–15/month

No Kafka, RabbitMQ, or dedicated worker fleet is necessary initially.

A worker can even run within the same NestJS application using an environment flag such as:

```env
WORKER_MODE=true
```

---

## Phase 3 — Scale-Out (When Needed)

As traffic and import volume increase, introduce:

- Dedicated worker containers
- Concurrency limits (respecting DeepSeek/OpenAI rate limits)
- Dead-letter queue (DLQ) for permanently failed jobs
- Fine-grained progress tracking

Example:

```ts
enrichmentProgress: {
    chunksDone: number;
    chunksTotal: number;
    questionsEnriched: number;
}
```

---

# Recommended Roadmap

| Stage | Approach |
|--------|----------|
| **Now** | In-process background processing (current MVP) + frontend polling |
| **Soon** | BullMQ + Redis when deploying multiple instances or requiring crash recovery |
| **Later** | Dedicated workers, progress tracking, and horizontal scaling |

---

# Simple Improvement Before BullMQ

To address the biggest weakness of the MVP (jobs stuck in `processing` after a server restart), implement a lightweight startup recovery hook.

### Startup Recovery Logic

On application startup:

```text
Find uploads where:

status = processing

AND

updatedAt older than N minutes

↓

Mark them as FAILED

↓

Reason:
"Enrichment interrupted by server restart"
```

This provides an inexpensive and effective safeguard until a proper queueing system (BullMQ + Redis) is introduced.