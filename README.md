# 🧺 Washing Machine Reservation

A simple app to reserve one of 2 washing machines in 1-hour slots, up to 7 days
ahead. Data is stored in **Netlify DB** (Neon Postgres) and accessed through a
**Netlify Function**.

## Structure

```
.
├── index.html                       # Frontend (HTML + Tailwind via CDN)
├── netlify.toml                     # Netlify build & redirect config
├── package.json                     # Function dependencies (@netlify/neon)
└── netlify/functions/
    └── reservations.mjs             # GET (retrieve) + POST (create) endpoint
```

## API

The function is exposed at `/api/reservations`:

- `GET  /api/reservations` → `{ reservations: [{ machine, date, hour, name, room }] }`
- `POST /api/reservations` with JSON `{ machine, date, hour, name, room }`
  - `201` on success, `409` if the slot is already taken, `400` on bad input.

The `reservations` table has a `UNIQUE (machine, date, hour)` constraint, so the
database itself prevents double-booking the same slot.

## Setup & run locally

1. Install the Netlify CLI and dependencies:
   ```bash
   npm install -g netlify-cli
   npm install
   ```

2. Link the site and provision the database:
   ```bash
   netlify link          # or: netlify init  (for a new site)
   netlify db init        # provisions Netlify DB (Neon) and sets NETLIFY_DATABASE_URL
   ```

3. Run locally (serves the page + functions together):
   ```bash
   netlify dev
   ```
   Open the URL it prints (e.g. http://localhost:8888).

## Deploy

```bash
netlify deploy --prod
```

Netlify injects `NETLIFY_DATABASE_URL` automatically once the database is linked,
so no manual environment variables are required. The table is created on the
function's first run.
