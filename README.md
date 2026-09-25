# EzPrep API

Backend for the EzPrep exam-prep app. One codebase can also run another instance (for example ExamFlex) by changing environment variables. Do not commit `.env`.

NestJS, MongoDB, JWT. Node `24.16.0`. Routes are under `/api/v1`. Interactive docs: `/api/docs`. Health check: `GET /api/v1/health`.

## Setup

```bash
npm install
cp .env.example .env
npm run start:dev
```

Fill `.env` before starting. `CORS_ORIGINS` must include the browser origin (local app is `http://localhost:3001`). In production, `CORS_ORIGINS` is required.

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Database |
| `INSTANCE_ID`, `INSTANCE_NAME` | Which deployment this process is |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Session tokens (default expiry `7d`) |
| `MSG91_AUTH_KEY` | Mobile OTP verification |
| `GOOGLE_CLIENT_ID` | Web OAuth client |
| `GOOGLE_CLIENT_SECRET` | Server only. Never put this in the frontend |
| `GOOGLE_CLIENT_IDS` | Optional extra audiences (Android, iOS), comma-separated |
| `GOOGLE_REDIRECT_URIS` | Exact redirect URIs allowed for the code exchange |
| `AWS_*` | Question and image uploads |
| `MATHPIX_*`, `DEEPSEEK_*` | Paper import |

If a key is listed twice in `.env`, the last value wins. Empty duplicates wipe a real value.

Restart the process after changing `.env`. Nest reads it once at startup.

## Authentication

Students get the same JWT from either sign-in method.

- `POST /api/v1/auth/verify-otp` — MSG91 access token from the phone widget. New numbers create an account.
- `POST /api/v1/auth/google` — one-time authorization code, redirect URI, and PKCE verifier. The API exchanges the code with Google using the client secret, then checks the ID token (signature, audience, issuer, expiry, and that the email is verified). A token sent by the browser is not trusted. The redirect URI must match `GOOGLE_REDIRECT_URIS` exactly, including a trailing slash.
- `POST /api/v1/auth/admin/login` — admin username and password. Admins cannot use OTP or Google.

Google accounts are matched by the stable Google subject first, then by email. See the security note below before relying on that email match.

On production, omit `http://localhost:3001` from `GOOGLE_REDIRECT_URIS`.

## What the API covers

Students: mock tests (topic-wise and full exam), attempts, bookmarks, analytics, current affairs, study content, search.

Admins: question bank, imports, full-mock drafts, users, dashboard. First admin can be created with `POST /api/v1/auth/admins` when none exists; after that, only an admin JWT can create another.

Request and response shapes are in Swagger.

## Scripts

```bash
npm run start:dev    # watch
npm run build && npm run start:prod
npm test             # unit tests
npm run test:cov     # coverage (80% minimum)
```

## Deploy

Each droplet has its own `.env`. Set `INSTANCE_ID`, `INSTANCE_NAME`, `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGINS`, and the Google values for that host. Build with `npm run build` and run `npm run start:prod` (`node dist/main`).

## Account linking

If an OTP account’s email was typed in on the profile and never verified, a later Google sign-in with that same address joins the existing account. Do not treat that as proof the phone account owns the Gmail address.
