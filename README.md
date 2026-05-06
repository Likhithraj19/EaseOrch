# EaseOrch

EaseOrch is a local-first backend for automating developer workflows across GitHub, Jira, and Slack.

Current implementation covers the first backend slice:

- TypeScript + Express API scaffold
- Prisma schema, migration, and seed
- GitHub webhook signature verification
- delivery ID deduplication
- raw webhook persistence
- normalized PR event creation
- queue handoff by `normalizedEventId`

## Project Layout

- `src/` application code
- `src/http/` webhook app and route handlers
- `src/github/` GitHub-specific helpers and tests
- `src/config/` env validation
- `src/db/` Prisma client
- `prisma/` schema, migrations, and seed
- `docs/plans/` design and implementation docs

## Local Development

Run PostgreSQL and Redis locally on your machine. Docker is optional for later deployment checks, not required for day-to-day work.

Create `.env` from `.env.example` and update values for your local setup:

```env
DATABASE_URL="postgresql://easeorch:easeorch@localhost:5432/easeorch?schema=public"
REDIS_URL="redis://localhost:6379"
GITHUB_WEBHOOK_SECRET="replace-me"
PORT="3000"
JIRA_ADAPTER_MODE="mock"
SLACK_ADAPTER_MODE="mock"
```

## Commands

```bash
npm install
npm run prisma:generate
npx prisma migrate dev --name init
npx prisma db seed
npm test
npm run build
npm run dev:api
npm run dev:worker
```

What they do:

- `npm test` runs the Jest test suite
- `npm run build` compiles TypeScript to `dist/`
- `npm run dev:api` starts the API in watch mode
- `npm run dev:worker` starts the worker entrypoint in watch mode

## Webhook Endpoint

GitHub webhook endpoint:

```text
POST /webhooks/github
```

Current supported normalized events:

- PR opened
- PR merged

## Notes

- Daily development should use local Postgres and Redis.
- Route tests are handler-level and do not require opening a local HTTP port.
- Real Jira and Slack adapters are not implemented yet; current wiring assumes mock mode.
