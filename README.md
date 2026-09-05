# Sarada Antyakshari — Cloudflare edition

A daily Telugu song guessing game running entirely on Cloudflare:

- React and Vite frontend served with Workers Static Assets
- one Cloudflare Worker for the game API and private media gateway
- D1 for songs, daily games, and server-authoritative sessions
- a private R2 bucket for question clips, covers, and previews
- optional Google AdSense side and bottom slots, disabled by default

The browser uses only same-origin URLs:

```text
POST /api/game
GET  /api/media?token=<opaque-encrypted-token>
GET  /api/question-clip?date=YYYY-MM-DD
GET  /api/suggestions
```

The media token is encrypted with AES-256-GCM. It contains a hashed session,
asset name, and expiry—not an R2 object path. The Worker validates the session
and game state before resolving and streaming an object. Browser users can
still inspect bytes they are allowed to play or view; no web application can
prevent that.

## Requirements

- Node.js 20.19 or newer
- npm
- a Cloudflare account for remote deployment

## Project structure

```text
src/                         React application
worker/index.ts              Worker entry point and static-assets fallback
worker/router.ts             JSON API action router
worker/repositories/         D1 queries
worker/services/             game rules and private R2 streaming
worker/validation/           request and media-path authorization
worker/utils/                dates, crypto, responses, and errors
migrations/                    D1 schema and attempt-history migration
wrangler.example.jsonc       Sanitized Worker configuration template
scripts/generate-wrangler-config.js  CI-only Wrangler configuration generator
```

## First-time Cloudflare setup

Authenticate and create the database and private bucket:

```bash
npm install
npx wrangler login
npx wrangler d1 create sarada-antyakshari
npx wrangler r2 bucket create sarada-antyakshari-songs
```

Copy `wrangler.example.jsonc` to the ignored local file `wrangler.jsonc`, then
replace its development D1 and R2 placeholders with the IDs used for local
remote-development testing. Never commit `wrangler.jsonc`.

Generate the media-token secret:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

For local development:

```bash
cp .dev.vars.example .dev.vars
```

Replace the value in `.dev.vars` with the generated secret. For production,
store the same kind of value as a Worker secret:

```bash
npx wrangler secret put MEDIA_TOKEN_SECRET
```

Never use a `VITE_` prefix for this secret. Variables with that prefix are
compiled into browser code.

## Database migrations

Apply the schema locally and remotely:

```bash
npm run db:migrate:local
npm run db:migrate:dev
```

Production schema migrations are applied automatically by GitHub Actions before
the Worker is deployed. This repository intentionally contains no application
data importer, database loader, or R2 uploader.

## R2 object layout

Keep the R2 bucket private. The runtime expects these bucket-relative keys:

```text
question-clips/YYYY-MM-DD.m4a
covers/<answer_song_id>.jpg
result-previews/<answer_song_id>.m4a
```

The autocomplete catalog is read from the fixed `suggestions.json` key. Do not
enable an R2 public development URL or custom public bucket domain.

## Local development

After configuring the development bindings and secret:

```bash
npm run dev
```

Open `http://localhost:5173`. The Cloudflare Vite plugin runs the frontend,
Worker, local D1, and local R2 together.

Normal development defaults to no ads and no ad space. To preview the ad
layout with placeholders and without requesting Google ads:

```bash
npm run dev:ads
```

The default Wrangler environment runs the frontend and Worker locally while its
bindings connect to the isolated remote development D1 database and `songs-dev`
R2 bucket. Authenticate once with `npx wrangler login` before starting it.
Copy `.env.development.example` to `.env.development.local` for public browser
settings and keep the development-only media secret in ignored `.dev.vars`.
Use `npm run db:migrate:dev` and `npm run dev` for development. There is no
development Worker deployment command. The existing
`db:migrate:local` command remains available for isolated Miniflare tests.

Production resources exist only in Wrangler's explicit `production` environment
and are deployed only by GitHub Actions after a push to `main`.
Use `.env.production.example` as its public-variable template. Store a separate
production media secret with
`npx wrangler secret put MEDIA_TOKEN_SECRET --env production`. The workflow
applies production D1 migrations and deploys the Worker after all checks pass.

The production workflow generates its ignored `wrangler.jsonc` from
`wrangler.example.jsonc`. Configure these GitHub `production` Environment
variables before deploying:

```text
CLOUDFLARE_PROD_D1_DATABASE_ID
CLOUDFLARE_PROD_R2_BUCKET_NAME
```

They are identifiers rather than credentials, but this arrangement keeps their
actual values out of the repository. The generator validates both values and
fails before the build if either is missing or malformed.

## AdSense production configuration

Use `.env.production.example` as the production-variable reference and configure
the corresponding GitHub `production` Environment variables before opting in:

```env
VITE_ADSENSE_ENABLED=true
VITE_ADSENSE_PRIVACY_REVIEWED=true
VITE_ADSENSE_CLIENT=ca-pub-xxxxxxxxxxxxxxxx
VITE_ADSENSE_LEFT_SLOT=1111111111
VITE_ADSENSE_RIGHT_SLOT=2222222222
VITE_ADSENSE_BOTTOM_SLOT=3333333333
```

Both enablement and privacy-review flags must be exactly `true`; the user must
still explicitly accept before Google is contacted. Keep the review flag false
until the production privacy notice, Google-certified CMP where required,
audience settings, and regional consent behavior are complete. See `SECURITY.md`.
`npm run dev:ads` shows placeholders without requesting Google ads.

## Validate and deploy

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run build:production
npx wrangler deploy --dry-run
```

Deployment itself is intentionally available only in GitHub Actions.

Attach a custom domain in the Cloudflare dashboard after the first deployment.
The Worker serves SPA routes (including `/archive/...`) using
`not_found_handling: single-page-application`.

## API behavior and security

- Sessions are random 256-bit tokens. Only SHA-256 hashes are stored in D1.
- Sessions expire after one hour by default.
- Every guess and skip is stored in `game_attempts`. A transactional D1 batch
  advances `game_sessions` and inserts the corresponding attempt atomically.
- Attempt updates include the prior session version and attempt count, so two
  concurrent submissions cannot both consume or record the same attempt.
- Resume responses return authoritative server attempt history. Browser
  `sessionStorage` is only a local display cache.
- Raw D1 rows are converted at the repository boundary. Integer booleans become
  TypeScript booleans, Unix seconds become `Date` objects, enums are validated,
  and snake_case database fields become camelCase application fields.
- The answer is returned only after a win or the final failed attempt.
- Archive bounds end at yesterday in `Asia/Kolkata`.
- Result media is inaccessible while a game is still playing.
- Question media is available only for existing `daily_games` rows. Its R2 key
  is derived as `question-clips/<question_date>.m4a`, matching production.
- R2 paths are built on the server and validated against the question date or
  answer song ID.
- Hourly cron cleanup removes expired session rows.
- Expired session cleanup cascades to its attempt rows; this project does not
  retain permanent player analytics.
- API and media responses use `no-store` and restrictive security headers.

Runtime settings are in `wrangler.jsonc`:

```text
MAX_ATTEMPTS=5
SESSION_TTL_SECONDS=3600
MEDIA_TOKEN_TTL_SECONDS=300
MAX_REQUEST_BYTES=16384
```

API, session-creation, and media routes also use Cloudflare rate-limit bindings
plus an independent application limiter. See `SECURITY.md` for budgets and
production guidance.

`ALLOWED_ORIGINS` is only needed for additional development origins. Production
calls are same-origin.

## Request budget

The searchable dropdown loads `/api/suggestions`. The Worker reads only the
`suggestions.json` object from the environment's private R2 binding: `songs-dev`
locally and `songs` in production. It does not query D1. The object contains only
song UUID, title, and movie title; the UUID is checked against
`daily_games.answer_song_id`, so duplicate titles remain unambiguous.

The normal game uses one start/resume request and one request per guess or skip.
Terminal answer metadata and result media references are included in the final
attempt response. Additional `media-url` calls occur only when a short-lived
media token needs refreshing after a load failure or expiry. R2 byte requests
are separate from game API calls.

## Supabase cutover

1. Create and populate D1.
2. Upload every private media object to R2 and verify key parity.
3. Deploy this Worker to a staging hostname.
4. Smoke-test start, resume, all five attempts, win/loss, archive, media retry,
   audio seeking, expired sessions, and mobile/desktop ad layouts.
5. Point the production domain to the Cloudflare Worker.
6. Keep Supabase read-only during a rollback window.
7. Remove Supabase storage/database only after production verification and a
   retained backup.

The migrated runtime has no Supabase client, publishable key, service-role key,
PostgreSQL RPC, Netlify Function, or browser-visible storage hostname.
