# SDOC

**Adaptive, explainable shipping-document verification for high-volume operations.**

SDOC processes the complete 520-email hackathon bundle, classifies each message, identifies Shipping Instruction (SI) and Bill of Lading (BL) documents, extracts seven business-critical fields, and produces a submission-ready result. Every decision remains inspectable: operators can see the evidence, correct uncertain cases, moderate learned knowledge, and export a schema-validated submission.

The core design is **deterministic first, AI only when needed**. Auditable rules resolve known evidence, structured AI handles only unresolved classifications, document roles, or fields, and deterministic validation always owns the final comparison status. This makes the system safer to review and materially reduces token usage.

## Submission at a glance

| Area                   | Delivered result                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------- |
| Challenge coverage     | Exact validation of all 520 expected email IDs                                        |
| Classification         | Five required categories with explainable evidence and confidence gates               |
| Document verification  | SI/BL role detection and deterministic comparison of seven required fields            |
| Input formats          | TXT, PDF, DOCX, and XLSX with format-aware evidence locations                         |
| Human oversight        | Review queue, correction preview, retry/reopen flow, and immutable audit history      |
| Adaptive learning      | Seed, probation, trusted, blocked, and retired phrase states with moderation controls |
| Operational visibility | Coverage, fallback, cache, latency, token, estimated cost, and review metrics         |
| Verification evidence  | 75/75 automated tests, 15/15 labelled classification cases, 520/520 output IDs        |
| Observed AI usage      | $0.80 across 229,219 tokens and 557 API requests in the captured development window   |

## Technical Architecture

```text
USER AND API

[Operations user] --> [React 19 operations UI] --> [Express 5 API]
                         Runs / Inbox / Review      Run / Email / Review
                         Knowledge / Metrics        Knowledge / Metrics

MAIN PROCESSING PATH

[Safe dataset ingestion]
          |
          v
[Deterministic email classification]
          |
          v
[TXT / PDF / DOCX / XLSX parsing]
          |
          v
[SI / BL role resolution]
          |
          v
[Seven-field extraction]
          |
          v
[Field-specific normalization]
          |
          v
[Deterministic comparison] --> [OK | MISMATCH | NEEDS_REVIEW]
                                      |
                                      v
                         [Dashboard / Metrics / Export]

SELECTIVE AI PATH

[Uncertain classification] --\
[Unresolved document role] ----> [Structured OpenAI fallback]
[Missing document fields] ----/              |
                                               v
                              [Schema + evidence validation]
                                               |
                                               v
                              [Content-addressed AI cache]
                                               |
                                               v
                                   [Resume main pipeline]

PERSISTENCE

[MongoDB] <--> Runs / Emails / Reviews / Knowledge / Audit events / AI cache
```

AI is deliberately a side path rather than the main pipeline: it is invoked only when deterministic classification, role detection, or field extraction cannot resolve the evidence. Accepted responses are schema-validated, evidence-checked, and cached before returning to the deterministic workflow.

The React client is an operations console rather than a black-box demo. It polls asynchronous processing runs, exposes per-stage evidence, supports human corrections, and downloads the exact submission contract. Express provides bounded and rate-limited APIs. MongoDB persists source hashes, runs, processing attempts, results, review cases, learned knowledge, cache entries, and audit events. A single production Docker image serves the compiled client and `/api`, while Docker Compose retains separate hot-reload services for local development.

## Implementation Details

### 1. Ingestion and orchestration

- The dataset repository resolves paths inside the configured bundle root, rejects traversal, and imports records by stable `emailId` upserts.
- Runs are asynchronous, concurrency-bounded, cancellable, retryable, and versioned for reproducibility.
- Submission export validates the schema and enforces exact, duplicate-free coverage of all 520 challenge IDs.

### 2. Adaptive email classification

- Weighted phrase evidence is scored separately across subject and body; minimum score and winning-margin gates prevent weak matches from being accepted.
- Only uncertain messages invoke a strict structured-output AI fallback. Returned evidence must occur verbatim in the source before it is trusted.
- Useful AI or human evidence can enter the knowledge base in low-weight probation. Generic, sensitive, shipment-specific, conflicting, or overlong phrases are rejected, and operators can block or retire entries.

### 3. Document understanding and comparison

- Format-specific parsers preserve evidence coordinates: lines for TXT, pages for PDF, paragraphs/table cells for DOCX, and sheets/cells for XLSX.
- File signatures are checked independently of extensions. Corrupt, encrypted, oversized, unsupported, sparse, and scanned inputs remain distinguishable instead of being collapsed into one error.
- Rules first identify SI/BL roles and extract `shipper`, `consignee`, `notify_party`, `port_of_loading`, `port_of_discharge`, `container_count`, and `gross_weight_kg`.
- AI receives only unresolved roles or missing fields. Its evidence is verified against extracted text, while field-specific normalizers and the deterministic comparator alone produce `OK`, `MISMATCH`, or `NEEDS_REVIEW`.

### 4. Human review and operational learning

- Uncertain cases enter a stage-specific review queue for attachment, readability, role, or field issues.
- Reviewers preview the deterministic result before saving corrections; optimistic version checks protect concurrent updates.
- Resolved cases retain notes and history, can be reopened, and can be reprocessed with human overrides. Knowledge moderation actions are separately audited and reversible.

### 5. Observability and cost control

- Every processing attempt records duration, AI fallbacks by stage, cache hits, input/output tokens, and estimated cost.
- AI cache keys include the source hash, purpose, model, prompt version, schema version, and requested fields, preventing stale results from crossing contract changes.
- Completed runs retain metric snapshots covering deterministic coverage, p95 latency, fallback and cache rates, review resolution, learning impact, and estimated spend.

## AI Usage and Cost Efficiency

Real API telemetry is valuable submission evidence when its scope is stated honestly. The captured OpenAI dashboard covers the development window and shows **$0.80 spend, 229,219 tokens, and 557 requests**.

![OpenAI API usage showing $0.80 spend, 229,219 tokens, and 557 requests](docs/assets/openai-api-usage.jpg)

Derived from that observed aggregate:

| Metric                     | Calculation                 | Observed value |
| -------------------------- | --------------------------- | -------------: |
| Tokens per API request     | 229,219 / 557               |            412 |
| Cost per API request       | $0.80 / 557                 |       $0.00144 |
| Blended cost per 1M tokens | $0.80 / 229,219 × 1,000,000 |          $3.49 |

If the same request mix and blended rate scaled linearly, the reference scenarios would be:

| API requests | Approx. tokens | Illustrative cost |
| -----------: | -------------: | ----------------: |
|        1,000 |        411,524 |             $1.44 |
|       10,000 |          4.12M |            $14.36 |
|      100,000 |         41.15M |           $143.63 |
|    1,000,000 |        411.52M |         $1,436.27 |

As a secondary scenario, **only if** the 557 captured requests are treated as one representative 520-email pass, the implied rate is 1.07 API requests and $0.00154 per email—about **$153.85 per 100,000 emails** or **$1,538.46 per million emails**.

> These are linear illustrations, not price guarantees. The screenshot aggregates development activity rather than an isolated production benchmark; model mix, cached-input share, prompt size, output size, retries, document complexity, and future provider pricing can change the result. Re-run a clean production-like workload before making a contractual cost claim. GPT-5.5 input, cached-input, and output tokens also have different list prices; see the [official OpenAI model pricing](https://developers.openai.com/api/docs/models/gpt-5.5).

The efficiency claim is supported by architecture, not the screenshot alone: deterministic routing avoids unnecessary calls, field-level fallback sends only unresolved data, strict schemas constrain output, and content-addressed caching prevents repeat charges.

## Challenges Faced

### Heterogeneous documents without losing evidence

The same business field can appear in a text line, PDF page, Word table, or spreadsheet cell. A common text-only parser would have made explanations weak, so each adapter preserves native location metadata and exposes parser-specific failure states.

### Balancing automation with safety

Forcing an answer improves apparent coverage but hides operational risk. SDOC instead makes uncertainty explicit through confidence gates, evidence verification, `NEEDS_REVIEW`, and human correction. Scanned evidence that cannot be verified locally is never silently accepted.

### Using AI without making the workflow opaque or expensive

Naively sending every email and attachment to a model would be costly and difficult to audit. The implemented cascade uses deterministic rules first, asks AI narrow structured questions only for unresolved work, validates responses, and caches accepted results.

### Learning without poisoning future decisions

Automatically learned phrases can be generic, sensitive, or shipment-specific. New evidence therefore starts in probation, promotion requires repeated support, conflicts are tracked, and moderation remains reversible. Evaluation also revealed that exact phrase matching generalizes poorly to heavily reworded external data; this limitation is recorded rather than hidden.

### Preserving the exact submission contract

Parallel processing, retries, review overrides, and partial failures can easily create missing or duplicate rows. Stable IDs, idempotent persistence, versioned runs, and an independent validator enforce exact challenge coverage before export.

## Future Roadmap

1. **Semantic but bounded learning:** replace exact long-phrase reuse with canonical concepts and 2–5-token candidates, refresh knowledge between processing epochs, and evaluate false positives on held-out data.
2. **OCR with evidence grounding:** add scanned-PDF/image OCR while retaining page coordinates and the same evidence-verification requirement.
3. **Production job execution:** move runs to durable workers with a queue, leases, idempotency keys, resumable progress, and horizontal scaling.
4. **Enterprise access controls:** activate authentication, organization-scoped data, role-based review permissions, SSO, and retention policies.
5. **Live integrations:** ingest from Microsoft 365/Gmail and export approved results to transport-management or ERP systems.
6. **Continuous evaluation:** add drift dashboards, larger labelled corpora, per-format extraction scores, calibrated confidence, and production cost/quality experiments.
7. **Further cost optimization:** route easy fallbacks to smaller models, evaluate Batch API processing, increase prompt-cache reuse, and set per-run cost budgets.

## Stack and prerequisites

- React 19, Vite 8, Tailwind CSS 4, Node.js 24 LTS, Express 5, Mongoose 9, MongoDB 8.0.
- npm with committed lockfiles, Nodemon, Docker and Docker Compose v2.
- Backend authentication dependencies: `jsonwebtoken` for JWT signing/verification and `bcryptjs` for password hashing/comparison. Authentication routes and token configuration will be added when authentication is implemented.
- Install Git and Docker Desktop, and keep Docker Desktop running with Linux containers. On Windows enable its WSL 2 backend. Linux users can use Docker Engine with the Compose plugin.
- No local Node.js, npm or MongoDB installation is required.

## Start

```sh
git clone https://github.com/excelyynxl-a11y/fn-key.git
cd fn-key
docker compose up --build
```

Create a root `.env` containing a reachable MongoDB URI before starting. The first build downloads images and dependencies. MongoDB must be reachable before the API starts; the API must become healthy before the frontend starts.

```dotenv
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>/<database>
# Required only when a classification, document role, or field needs AI fallback.
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
```

- Frontend: http://localhost:5173
- Backend: http://localhost:5000 — `GET /` returns the SDOC API identity envelope.
- Readiness: http://localhost:5000/health — returns 200 when MongoDB is connected, otherwise 503.

Host ports bind to loopback for local development. The backend uses `MONGO_URI` to connect to MongoDB Atlas or another reachable MongoDB deployment. Browser JavaScript uses the host API URL, because the browser cannot resolve Compose service names. The challenge bundle is mounted read-only at `/data/sdoc` inside the API container.

## Deploy one Docker service on Render

The root [`Dockerfile`](Dockerfile) is the production image. It builds the React client, installs only the server's production dependencies, copies the challenge dataset into the image, and runs one Express process that serves both the UI and `/api`. The development Dockerfiles under `client/` and `server/` remain dedicated to the local Compose workflow.

### 1. Prepare MongoDB Atlas

1. Create an Atlas cluster and a database user with a unique application password.
2. Copy the Node.js SRV connection string and include a database name, for example `mongodb+srv://USER:PASSWORD@HOST/sdoc?retryWrites=true&w=majority`.
3. In Atlas **Network Access**, add all outbound CIDR ranges shown under the Render service's **Connect > Outbound** tab. For a short-lived demo, `0.0.0.0/0` is simpler but less restrictive.

### 2. Create the Render service

1. Push the repository and the root `Dockerfile` to the branch you want to deploy.
2. In Render select **New > Web Service**, connect the repository, and select that branch.
3. Set **Language** to **Docker** and **Dockerfile Path** to `./Dockerfile`. Keep the repository root as the Docker build context.
4. Do not add a build command, start command, or Docker command override. The image's `CMD` starts the API.
5. Choose a service name before setting `CLIENT_ORIGIN`. For a service named `sdoc-demo`, the initial origin is `https://sdoc-demo.onrender.com`.
6. Under **Advanced**, set **Health Check Path** to `/health`.

### 3. Add environment variables

Set these before the first deploy:

| Variable                         | Required    | Render value                                                                     |
| -------------------------------- | ----------- | -------------------------------------------------------------------------------- |
| `MONGO_URI`                      | Yes         | Full MongoDB Atlas SRV connection string, including the database name            |
| `CLIENT_ORIGIN`                  | Yes         | Exact public origin, such as `https://sdoc-demo.onrender.com`; no trailing slash |
| `OPENAI_API_KEY`                 | Recommended | OpenAI project API key; without it, unresolved AI fallbacks become review cases  |
| `OPENAI_MODEL`                   | Recommended | Model available to the API project; defaults to `gpt-5.5`                        |
| `PROCESSING_CONCURRENCY`         | Optional    | `4`; use `2` on a memory-constrained instance                                    |
| `OPENAI_MAX_ATTEMPTS`            | Optional    | `3`                                                                              |
| `OPENAI_TIMEOUT_MS`              | Optional    | `20000`                                                                          |
| `API_RATE_LIMIT_MAXIMUM`         | Optional    | `300`                                                                            |
| `API_RATE_LIMIT_WINDOW_MS`       | Optional    | `60000`                                                                          |
| `JSON_BODY_LIMIT`                | Optional    | `1mb`                                                                            |
| `CLASSIFICATION_MIN_SCORE`       | Optional    | `4`                                                                              |
| `CLASSIFICATION_MIN_MARGIN`      | Optional    | `1.5`                                                                            |
| `OPENAI_INPUT_COST_PER_MILLION`  | Optional    | Current input-token price, or `0` to disable estimates                           |
| `OPENAI_OUTPUT_COST_PER_MILLION` | Optional    | Current output-token price, or `0` to disable estimates                          |

Do **not** set `PORT`: Render injects it and the server already binds it on `0.0.0.0`. Do not set `VITE_API_URL`, `DATASET_PATH`, `CLIENT_DIST_PATH`, or `NODE_ENV` for this deployment; the production image supplies the correct same-origin and internal-path configuration. Never put the OpenAI or MongoDB secret into a `VITE_` variable.

If a custom domain is added later, set `CLIENT_ORIGIN` to a comma-separated exact allowlist containing every browser origin that should work, for example `https://docs.example.com,https://sdoc-demo.onrender.com`, then redeploy.

### 4. Deploy and verify

Create the service and watch the build logs. A healthy deployment should satisfy:

- `/health` returns `200` with `{"status":"ok"}` after MongoDB connects.
- `/` serves the React application.
- `/api` returns the API identity envelope.
- Starting a run can read the bundled dataset and write results to Atlas.

The filesystem is intentionally disposable: durable application state is stored in MongoDB, while the read-only challenge dataset is rebuilt into every image. A persistent Render disk is not required. Processing runs execute inside the web process; avoid deploying or restarting while a run is active. A paid always-on instance is preferable for long runs because sleeping or restarting an instance interrupts in-memory work, even though completed records remain in MongoDB.

## Operations workflow

1. Open http://localhost:5173.
2. Select **Start new run**.
3. The API classifies each message, parses supported attachment formats, resolves SI/BL roles, and extracts and normalizes the seven comparison fields.
   An active run can be stopped from the progress panel; no new emails are scheduled after cancellation is requested.
4. Select an inbox row to inspect classification evidence, parser outcomes, field values, page/sheet/cell/line evidence, extraction method, confidence, and final status.
5. Download a completed run's exact submission object from `GET /api/runs/:runId/submission`.
6. Resolve review cases with a required note and preview the deterministic outcome before saving.
7. Inspect the retained review history; retry one resolved email or reopen its case when new evidence arrives.
8. Inspect persisted run metrics and export the updated submission from the dashboard.

AI evidence must occur verbatim in the source text whenever embedded text is available. New classification phrases are rejected when they are generic, sensitive, shipment-specific, too long, or conflicting; accepted phrases begin in low-weight probation. Document AI requests contain only unresolved roles or fields, use strict schemas, and are cached by source hash, model, prompt, schema, and requested fields. Scanned evidence that cannot be verified locally remains `NEEDS_REVIEW`.

Supported attachment handling:

- TXT preserves line numbers and detects invalid UTF-8 replacement characters.
- PDF extracts embedded text by page, detects sparse/scanned content, and enforces a page limit.
- DOCX preserves paragraph and table-cell reading order.
- XLSX inspects all non-empty sheets and preserves sheet/cell relationships.
- File signatures are checked independently of extensions; unsupported, corrupt, encrypted, empty, and scanned outcomes remain distinguishable.

Implemented API paths:

| Method      | Path                                   | Purpose                                                                         |
| ----------- | -------------------------------------- | ------------------------------------------------------------------------------- |
| `POST`      | `/api/runs`                            | Start an asynchronous bundle run                                                |
| `GET`       | `/api/runs`                            | List processing runs                                                            |
| `GET`       | `/api/runs/:runId`                     | Poll run progress                                                               |
| `POST`      | `/api/runs/:runId/retry`               | Retry failed and review items                                                   |
| `POST`      | `/api/runs/:runId/cancel`              | Cooperatively stop an active run                                                |
| `GET`       | `/api/runs/:runId/submission`          | Validate and export submission JSON                                             |
| `POST`      | `/api/runs/:runId/submission/validate` | Validate schema and exact email-ID coverage without downloading                 |
| `GET`       | `/api/runs/:runId/metrics`             | Return coverage, AI, cache, latency, cost, and review metrics                   |
| `GET`       | `/api/emails?runId=...`                | List results for a run                                                          |
| `GET`       | `/api/emails/:emailId`                 | Inspect one complete result                                                     |
| `POST`      | `/api/emails/:emailId/retry`           | Reprocess one email with saved review overrides                                 |
| `GET/PATCH` | `/api/reviews[/:reviewId]`             | List, inspect, preview, and resolve review cases with optimistic version checks |
| `POST`      | `/api/reviews/:reviewId/reopen`        | Reopen a resolved review with a required reason and version check               |
| `GET/PATCH` | `/api/knowledge[/:id]`                 | Inspect and moderate adaptive knowledge                                         |
| `GET`       | `/api/knowledge/audit`                 | Inspect immutable learning and moderation events                                |

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

Export and independently validate a completed run from `server/`:

```sh
npm run submission:export -- <runId> submission.json http://localhost:5000
npm run submission:validate -- submission.json ../sdoc-hackathon-bundle
npm audit --omit=dev
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

| Variable                         | Default                                                      | Purpose                                                            |
| -------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------ |
| `PORT`                           | `5000`                                                       | API container and host port                                        |
| `CLIENT_PORT`                    | `5173`                                                       | Frontend host port                                                 |
| `MONGO_URI`                      | Required                                                     | MongoDB Atlas or other reachable MongoDB connection string         |
| `CLIENT_ORIGIN`                  | `http://localhost:5173`                                      | Allowed browser origin for CORS                                    |
| `VITE_API_URL`                   | `http://localhost:5000` in Compose; same origin when omitted | Optional separate API URL used by the browser                      |
| `WATCH_USE_POLLING`              | `true`                                                       | Vite polling for mounted files                                     |
| `OPENAI_API_KEY`                 | Empty                                                        | Used only for uncertain classifications, document roles, or fields |
| `OPENAI_MODEL`                   | `gpt-5.5`                                                    | Configurable Responses API model                                   |
| `OPENAI_MAX_ATTEMPTS`            | `3`                                                          | Maximum structured-AI attempts for transient failures              |
| `OPENAI_TIMEOUT_MS`              | `20000`                                                      | Timeout per AI attempt in milliseconds                             |
| `JSON_BODY_LIMIT`                | `1mb`                                                        | Maximum JSON request body accepted by Express                      |
| `API_RATE_LIMIT_MAXIMUM`         | `300`                                                        | Requests allowed per client within one rate-limit window           |
| `API_RATE_LIMIT_WINDOW_MS`       | `60000`                                                      | Rate-limit window in milliseconds                                  |
| `OPENAI_INPUT_COST_PER_MILLION`  | `0`                                                          | Optional input-token price used for estimated cost                 |
| `OPENAI_OUTPUT_COST_PER_MILLION` | `0`                                                          | Optional output-token price used for estimated cost                |
| `CLASSIFICATION_MIN_SCORE`       | `4`                                                          | Minimum deterministic winning score                                |
| `CLASSIFICATION_MIN_MARGIN`      | `1.5`                                                        | Minimum lead over the second category                              |
| `PROCESSING_CONCURRENCY`         | `4`                                                          | Maximum emails processed concurrently                              |
| `DATASET_PATH`                   | `/data/sdoc` in Compose                                      | Read-only challenge bundle location                                |

For the local Compose stack, if changing `PORT`, also update `VITE_API_URL`; if changing `CLIENT_PORT`, update `CLIENT_ORIGIN`. Run `docker compose up -d` after changing root environment values so containers are recreated with the new settings. Vite exposes `VITE_` variables to the browser: never place secrets in them. The backend also supports dotenv for optional direct Node execution; Docker supplies its environment through Compose.

## MongoDB and persistence

Email records, processing runs, extracted fields, comparison results, review history, and per-attempt operational metrics are persisted through Mongoose. Completed-run metric snapshots remain available after a later run claims the current email records. Dataset imports use `emailId` upserts, so rerunning the same source does not create duplicate email documents. MongoDB network access must allow the API host; if Atlas reports that no server can be reached, check its network access list and credentials.

## Security, privacy, and limitations

- Source documents are processed locally from the configured dataset root; path traversal, extension/signature mismatch, oversized parser inputs, and excessive OOXML expansion are rejected.
- API responses include request IDs. Browser origins use an exact allowlist, JSON bodies are bounded, API traffic is rate limited, and routine server logs do not print document bodies or credentials.
- AI requests contain only the material required for the unresolved classification, role, or field. Provider credentials remain server-side.
- Learned category knowledge currently uses exact normalized phrase matching. Sentence-length phrases may generalize poorly to differently worded datasets; this is recorded in the evaluation log and should be addressed with bounded concept/n-gram learning before production use.
- Scanned documents without locally verifiable evidence remain `NEEDS_REVIEW`. Authentication, multi-user authorization, live email-provider ingestion, and distributed workers remain post-hackathon work.

## Structure

```text
client/
  src/
    components/          # Run progress, inbox, status and comparison UI
    pages/               # Stage 4 operations and review dashboard
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
    services/            # Import, parsers, adaptive AI fallbacks, extraction, comparison, run and export logic
    app.js
  server.js
  nodemon.json
  Dockerfile
  package.json
  package-lock.json
docker-compose.yml
Dockerfile                  # Single-container production image for Render
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

The Compose stack and the Dockerfiles inside `client/` and `server/` are for development. Use the root production `Dockerfile` and the Render configuration above for a single-service deployment.
