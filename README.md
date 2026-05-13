# EaseOrch

A backend service that automates developer workflows across GitHub, Jira, and Slack. When a pull request opens or merges, EaseOrch comments on the linked Jira issue, transitions it, and posts a Slack notification — driven by a signed GitHub webhook.

## Stack

Node.js 20, TypeScript, Express, Prisma, PostgreSQL, Redis, BullMQ. Multi-stage Docker build for deployment.

## How it works

1. GitHub sends a webhook to `POST /webhooks/github`.
2. The API verifies `X-Hub-Signature-256`, deduplicates by delivery ID, persists the raw payload, and creates a normalized event.
3. A BullMQ job is enqueued referencing the event by ID.
4. The worker resolves the workflow plan, runs Jira + Slack actions through adapter clients, and persists execution, attempts, and per-action results.
5. Retryable failures retry with exponential backoff (3 attempts). Terminal failures finalize the execution row to `failed`.

## Quick start (local)

Requires Node 20, PostgreSQL, and Redis on the host.

```bash
npm install
cp .env.example .env       # then edit values
npm run prisma:generate
npx prisma migrate dev --name init
npx prisma db seed

npm run dev:api            # http://localhost:3000
npm run dev:worker         # workflow worker
npm test
```

## Quick start (Docker)

```bash
docker compose up          # postgres → redis → migrate → api + worker
docker compose down        # tear down, keep DB volume
docker compose down -v     # tear down + wipe DB
```

## Webhook endpoint

```
POST /webhooks/github
```

Supported events: `pull_request.opened` and `pull_request.closed` (merged). Other actions are accepted but ignored after raw persistence.

## Adapter modes

`JIRA_ADAPTER_MODE` and `SLACK_ADAPTER_MODE` accept `mock` or `real`.

- `mock` — in-process mock that returns success. Used for local development and the test suite.
- `real` — not implemented yet. Will be wired to live Jira REST and Slack Web API clients.

## Status

Implemented: webhook ingest, event normalization, workflow planning, BullMQ worker with retry semantics, mock Jira/Slack adapters, persisted executions, Dockerized deployment.

Pending: real Jira and Slack HTTP adapters.
