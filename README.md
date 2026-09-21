# FN Key - MERN development environment

SDOC is an adaptive shipping-document verification application built on React, Express, and MongoDB. Stage 2 imports the 520-email challenge bundle, scores versioned category phrases, sends only uncertain cases through a strict structured AI fallback, safely learns probation phrases, and caches validated AI decisions. The existing document flow parses plain-text SI/BL pairs, compares the seven required fields, records review reasons, and exports the exact submission JSON shape.

## Stack and prerequisites

- React 19, Vite 8, Tailwind CSS 4, Node.js 24 LTS, Express 5, Mongoose 9, MongoDB 8.0.
- npm with committed lockfiles, Nodemon, Docker and Docker Compose v2.
- Backend authentication dependencies: `jsonwebtoken` for JWT signing/verification and `bcryptjs` for password hashing/comparison. Authentication routes and token configuration will be added when authentication is implemented.
- Install Git and Docker Desktop, and keep Docker Desktop running with Linux containers. On Windows enable its WSL 2 backend. Linux users can use Docker Engine with the Compose plugin.
- No local Node.js, npm or MongoDB installation is required.

## Start

```sh
git clone <repository>
cd <repository>
docker compose up --build
```

Create a root `.env` containing a reachable MongoDB URI before starting. The first build downloads images and dependencies. MongoDB must be reachable before the API starts; the API must become healthy before the frontend starts.

```dotenv
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>/<database>
# Required when a message falls below the deterministic classification thresholds.
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
```

- Frontend: http://localhost:5173
- Backend: http://localhost:5000 — `GET /` returns the SDOC API identity envelope.
- Readiness: http://localhost:5000/health — returns 200 when MongoDB is connected, otherwise 503.

Host ports bind to loopback for local development. The backend uses `MONGO_URI` to connect to MongoDB Atlas or another reachable MongoDB deployment. Browser JavaScript uses the host API URL, because the browser cannot resolve Compose service names. The challenge bundle is mounted read-only at `/data/sdoc` inside the API container.

## Stage 2 workflow

1. Open http://localhost:5173.
2. Select **Start new run**.
3. The API seeds the phrase knowledge base idempotently, scores every email, and uses the structured AI fallback only when the score or lead is insufficient.
4. Select an inbox row to inspect category scores, matched phrases, confidence, decision method, status, and comparison evidence.
5. Download a completed run's exact submission object from `GET /api/runs/:runId/submission`.

AI evidence must occur verbatim in the email. New phrases are rejected when they are generic, sensitive, shipment-specific, too long, or conflicting; accepted phrases begin in low-weight probation. Repeated runs reuse the hash cache and do not count the same email twice as independent phrase support.

Implemented API paths:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/runs` | Start an asynchronous bundle run |
| `GET` | `/api/runs` | List processing runs |
| `GET` | `/api/runs/:runId` | Poll run progress |
| `POST` | `/api/runs/:runId/retry` | Retry failed and review items |
| `GET` | `/api/runs/:runId/submission` | Validate and export submission JSON |
| `GET` | `/api/emails?runId=...` | List results for a run |
| `GET` | `/api/emails/:emailId` | Inspect one complete result |

## Daily commands

```sh
docker compose up                    # Start with attached logs
docker compose up --build            # Rebuild and start
docker compose up -d                 # Start in the background
docker compose down                 # Stop and remove containers, preserve data
docker compose logs                 # Show logs
docker compose logs -f              # Follow logs
docker compose ps                   # Show service health
docker compose config --quiet       # Validate configuration
```

Run the focused checks and the manually labeled classification evaluation from the repository root:

```sh
cd server && npm test
npm run evaluate:classification
cd ../client && npm run build
```

Use Ctrl+C to stop an attached run. After Dockerfile or dependency changes, use `docker compose up --build`. Edit files under `client/src/` and `server/src/` on your host for hot reload; no rebuild is needed. Vite listens on `0.0.0.0`; polling is enabled for Docker Desktop mounts, and Nodemon polls the backend files.

Source directories are bind-mounted. Separate named volumes hold Linux `node_modules`, isolating them from host dependencies. Each app runs `npm ci` automatically on startup to synchronize its dependency volume with the lockfile. This requires registry access when dependencies are not cached and adds a short startup delay.

To add a dependency without local npm, use `docker compose exec server npm install <package>` (or replace `server` with `client`), then commit both package files and rebuild. A frontend production build can be checked with `docker compose exec client npm run build`.

## Frontend styling

Use Tailwind utility classes in React `className` attributes. Tailwind is integrated through the official `@tailwindcss/vite` plugin; `client/src/styles.css` imports Tailwind and is loaded by `main.jsx`. Classes in frontend source files are detected automatically, and edits use the existing Vite hot reload workflow.

For example: `<h1 className="text-3xl font-bold text-slate-900">Hello</h1>`.

This uses Tailwind 4: no separate Tailwind or PostCSS configuration file is needed for the default setup. See the [Tailwind Vite guide](https://tailwindcss.com/docs/installation/using-vite).

## Environment variables

Compose reads a root `.env` and explicitly passes configuration to containers. Keep the local `.env` untracked and never commit real credentials.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5000` | API container and host port |
| `CLIENT_PORT` | `5173` | Frontend host port |
| `MONGO_URI` | Required | MongoDB Atlas or other reachable MongoDB connection string |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed browser origin for CORS |
| `VITE_API_URL` | `http://localhost:5000` | API URL used by the browser |
| `WATCH_USE_POLLING` | `true` | Vite polling for mounted files |
| `OPENAI_API_KEY` | Empty | Used only for uncertain email classifications |
| `OPENAI_MODEL` | `gpt-5.5` | Configurable Responses API model |
| `OPENAI_MAX_ATTEMPTS` | `3` | Maximum structured-AI attempts for transient failures |
| `OPENAI_TIMEOUT_MS` | `20000` | Timeout per AI attempt in milliseconds |
| `CLASSIFICATION_MIN_SCORE` | `4` | Minimum deterministic winning score |
| `CLASSIFICATION_MIN_MARGIN` | `1.5` | Minimum lead over the second category |
| `PROCESSING_CONCURRENCY` | `4` | Maximum emails processed concurrently |
| `DATASET_PATH` | `/data/sdoc` in Compose | Read-only challenge bundle location |

If changing `PORT`, also update `VITE_API_URL`. If changing `CLIENT_PORT`, update `CLIENT_ORIGIN`. Run `docker compose up -d` after changing root environment values so containers are recreated with the new settings. Vite exposes `VITE_` variables to the browser: never place secrets in them. The backend also supports dotenv for optional direct Node execution; Docker supplies its environment through Compose.

## MongoDB and persistence

Email records, processing runs, extracted fields, and comparison results are persisted through Mongoose. Dataset imports use `emailId` upserts, so rerunning the same source does not create duplicate email documents. MongoDB network access must allow the API host; if Atlas reports that no server can be reached, check its network access list and credentials.

## Structure

```text
client/
  src/
    components/          # Run progress, inbox, status and comparison UI
    pages/               # Stage 2 dashboard
    services/api.js      # Shared fetch helper
    App.jsx
    main.jsx
    styles.css
  Dockerfile
  vite.config.js
  package.json
  package-lock.json
server/
  src/
    config/db.js
    constants/           # Challenge enums and pipeline version
    controllers/         # Run and email APIs
    middleware/
    models/              # Email, run, knowledge, AI cache and audit persistence
    repositories/        # Safe dataset access
    routes/
    schemas/             # Zod request/output contracts
    services/            # Import, adaptive classification, learning, comparison, run and export logic
    app.js
  server.js
  nodemon.json
  Dockerfile
  package.json
  package-lock.json
docker-compose.yml
.gitignore
README.md
```

Empty extension directories contain `.gitkeep` only. Both apps have `.dockerignore` files to exclude dependencies, build output and environment files from image contexts.

## Troubleshooting

- **Cannot connect to Docker:** start Docker Desktop, wait for its engine and check `docker info`. Use Linux containers.
- **Port already allocated:** stop the conflicting program or change the environment variables together as described above.
- **API waiting or failing:** inspect `docker compose logs server`. Confirm that `MONGO_URI` is valid and the API host is allowed by MongoDB Atlas. Check registry/network access if `npm ci` fails.
- **Changes not appearing:** check Docker Desktop file sharing and confirm the repository is the mounted folder. Polling is enabled by default. Environment changes require container recreation.
- **Missing dependencies after switching branches:** restart the affected app with `docker compose restart client server`; startup `npm ci` resynchronizes dependencies. Rebuild if the image or Dockerfile changed.
- **CORS errors:** `CLIENT_ORIGIN` must exactly match the browser's origin, including scheme and port. Use `localhost` consistently.
- **Image download/build failures:** check internet access, proxy settings and available disk space; rerun `docker compose up --build`.

This Compose stack and its Dockerfiles are for development. A production deployment needs a built/static frontend, a production API image, secret management, database access control and a deployment-specific network configuration.
