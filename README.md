# tracks.biz-fullstack-test

Small ETL + API that ingests a Spotify-like playlist fixture into Postgres, then serves read-only endpoints over Fastify.

**What’s here**
- Postgres schema with constraints and indexes (`db/postgres/schema.sql`)
- Ingest CLI with idempotent upserts (`src/ingest.js`)
- Fastify API with one raw-SQL endpoint (`src/api/*`)
- Unit + integration tests (Node’s built-in runner)

**Prereqs**
- Node `v20` (see `.nvmrc`)
- Postgres (or run `docker compose up -d db`)

**Setup**
- `cp .env.example .env` (defaults work with Docker compose)
- `npm install`
- If not using Docker compose, apply schema: `psql -f db/postgres/schema.sql`

**Ingest**
- Default (uses fixtures):
  - `npm run ingest`
- Custom paths:
  - `node src/ingest.js --from fixtures/playlist.basic.json --features fixtures/audio_features.json`

**Run API**
- `npm start`
- Swagger UI: `http://localhost:3000/docs`
- Health: `GET /health`

**Endpoints**
- `GET /playlists/:id/tracks?energyMin=0.7`
  - Returns playlist tracks with `audio_features.energy >= energyMin`, ordered by energy DESC, with embedded artists.
  - Example: `curl 'http://localhost:3000/playlists/1/tracks?energyMin=0.6'`
- `GET /artists/:id/summary`
  - Returns artist row, top 5 tracks by popularity, and average audio features across those tracks.

**Tests**
- All: `npm test`
- Unit only: `npm run test:unit`
- Integration only: `npm run test:integration` (requires Postgres running + schema loaded)

**Notes**
- Upserts use `ON CONFLICT DO NOTHING` to ensure idempotency.
- Useful indexes included in the schema (e.g., playlist lookups, track popularity, artist-track mapping).
- ClickHouse part of the challenge can be added under `ch/` as SQL files (no runtime required).
