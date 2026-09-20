# FN Key - MERN development environment

Shared JavaScript development foundation for the team. It contains a minimal React page and Express API, with local MongoDB and hot reload. No application features or authentication are implemented. Existing hackathon documents and `sdoc-hackathon-bundle/` are reference material and are preserved.

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

Defaults work immediately without an `.env` file. The first build downloads images and dependencies. MongoDB must become healthy before the API starts; the API must become healthy before the frontend starts.

- Frontend: http://localhost:5173
- Backend: http://localhost:5000 — `GET /` returns `{"message":"API is running"}`.
- Readiness: http://localhost:5000/health — returns 200 when MongoDB is connected, otherwise 503.

Host ports bind to loopback for local development. Container services use the Compose internal network; the backend connects to `mongodb:27017`, never `localhost`. Browser JavaScript uses the host API URL, because the browser cannot resolve Compose service names.

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

Use Ctrl+C to stop an attached run. After Dockerfile or dependency changes, use `docker compose up --build`. Edit files under `client/src/` and `server/src/` on your host for hot reload; no rebuild is needed. Vite listens on `0.0.0.0`; polling is enabled for Docker Desktop mounts, and Nodemon polls the backend files.

Source directories are bind-mounted. Separate named volumes hold Linux `node_modules`, isolating them from host dependencies. Each app runs `npm ci` automatically on startup to synchronize its dependency volume with the lockfile. This requires registry access when dependencies are not cached and adds a short startup delay.

To add a dependency without local npm, use `docker compose exec server npm install <package>` (or replace `server` with `client`), then commit both package files and rebuild. A frontend production build can be checked with `docker compose exec client npm run build`.

## Frontend styling

Use Tailwind utility classes in React `className` attributes. Tailwind is integrated through the official `@tailwindcss/vite` plugin; `client/src/styles.css` imports Tailwind and is loaded by `main.jsx`. Classes in frontend source files are detected automatically, and edits use the existing Vite hot reload workflow.

For example: `<h1 className="text-3xl font-bold text-slate-900">Hello</h1>`.

This uses Tailwind 4: no separate Tailwind or PostCSS configuration file is needed for the default setup. See the [Tailwind Vite guide](https://tailwindcss.com/docs/installation/using-vite).

## Environment variables

Compose reads an optional root `.env` to override defaults in `docker-compose.yml` and explicitly passes variables to containers. To customize, copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell or `cp .env.example .env` in a POSIX shell). The local `.env` is ignored by Git; commit only `.env.example`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5000` | API container and host port |
| `CLIENT_PORT` | `5173` | Frontend host port |
| `MONGO_URI` | `mongodb://mongodb:27017/mern_database` | API database connection |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed browser origin for CORS |
| `VITE_API_URL` | `http://localhost:5000` | API URL used by the browser |
| `WATCH_USE_POLLING` | `true` | Vite polling for mounted files |

If changing `PORT`, also update `VITE_API_URL`. If changing `CLIENT_PORT`, update `CLIENT_ORIGIN`. Run `docker compose up -d` after changing root environment values so containers are recreated with the new settings. Vite exposes `VITE_` variables to the browser: never place secrets in them. The backend also supports dotenv for optional direct Node execution; Docker supplies its environment through Compose.

## MongoDB and persistence

MongoDB listens on port 27017 only inside Docker; it is not published to the host. Data resides in the named `mongodb_data` volume (prefixed by the Compose project name). Normal restarts, rebuilds and `docker compose down` preserve it. MongoDB creates the database when the first data is written.

```sh
docker compose exec mongodb mongosh mern_database
```

For a deliberate full reset, `docker compose down -v` removes ALL project volumes, including database data and dependency caches. This is destructive; use normal `down` to keep data.

## Structure

```text
client/
  src/
    components/          # Future shared UI
    pages/               # Future pages
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
    controllers/         # Future API controllers
    middleware/
    models/
    routes/
    app.js
  server.js
  nodemon.json
  Dockerfile
  package.json
  package-lock.json
docker-compose.yml
.env.example
.gitignore
README.md
```

Empty extension directories contain `.gitkeep` only. Both apps have `.dockerignore` files to exclude dependencies, build output and environment files from image contexts.

## Troubleshooting

- **Cannot connect to Docker:** start Docker Desktop, wait for its engine and check `docker info`. Use Linux containers.
- **Port already allocated:** stop the conflicting program or change the environment variables together as described above.
- **API waiting or failing:** inspect `docker compose logs mongodb server`. The Docker MongoDB hostname must be `mongodb`. Check registry/network access if `npm ci` fails.
- **Changes not appearing:** check Docker Desktop file sharing and confirm the repository is the mounted folder. Polling is enabled by default. Environment changes require container recreation.
- **Missing dependencies after switching branches:** restart the affected app with `docker compose restart client server`; startup `npm ci` resynchronizes dependencies. Rebuild if the image or Dockerfile changed.
- **CORS errors:** `CLIENT_ORIGIN` must exactly match the browser's origin, including scheme and port. Use `localhost` consistently.
- **Image download/build failures:** check internet access, proxy settings and available disk space; rerun `docker compose up --build`.

This Compose stack and its Dockerfiles are for development. A production deployment needs a built/static frontend, a production API image, secret management, database access control and a deployment-specific network configuration.
