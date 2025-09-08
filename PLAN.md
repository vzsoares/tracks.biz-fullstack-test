# 0) Repo bootstrap

* Init npm. Add deps: `fastify`, `pg`, `fastify-plugin`, `fastify-swagger` (optional), `dotenv`, `jest`, `pino-pretty`, `yargs`.
* Add `.nvmrc` with your Node LTS version (e.g. `20`).
* Create folders: `db/postgres`, `src/api`, `src/db`, `src/ingest`, `ch`, `tests/{unit,integration}`, `fixtures`.
* Create `.env.example` with `DATABASE_URL`, `PORT`, `BATCH_SIZE`.

---

# 1) Schema (OLTP) + DB setup

**1.1 Docker Compose**

* `docker-compose.yml` with `postgres:16-alpine`.
* Mount `db/postgres/schema.sql` to `/docker-entrypoint-initdb.d/00-schema.sql:ro`.

**1.2 Postgres schema**

* Tables: `artists`, `albums`, `tracks`, `playlists`, `playlist_tracks`, `audio_features`, `track_artists`.
* Add PKs, FKs, `NOT NULL`, `CHECK`, composite UNIQUE on `(playlist_id, track_id, position)`.
* Indexes: `playlist_tracks(playlist_id)`, `tracks(popularity desc)`, `track_artists(artist_id)`.

**1.3 DB client helpers**

* `src/db.js`: pg Pool ,transaction helper , placeholder helper.

---

# 2) Ingest CLI

**2.1 CLI scaffolding**

* `src/ingest.js` with `yargs` flags: `--from`, `--features`, `--batch`.
* Load env with dotenv.

**2.2 Parse & normalize**

* Parse playlist JSON → arrays of `artists`, `albums`, `tracks`, `track_artists`, `playlist`, `playlist_tracks`.
* Parse audio features JSON into a Map keyed by `track_id`.

**2.3 Transactional batched upserts**

* For each batch:

  * Upsert artists, albums, tracks, playlist, playlist\_tracks, track\_artists, audio\_features.
  * Use `ON CONFLICT … DO UPDATE` for mutable fields.
  * Skip missing audio features.
* Log inserted counts + duration.

---

# 3) API (Fastify + JSON Schema)

**3.1 Fastify server**

* `src/server.js`: build Fastify instance, register pg pool plugin, register routes.
* Add `/health`.
* Start only if not under test.

**3.2 JSON Schemas**

* Define schemas directly in route options (`schema: { params, querystring, response }`).
* Playlist tracks route:

  * Params: `{ id: number }`
  * Querystring: `{ energyMin: number, default: 0, min: 0, max: 1 }`
* Artist summary route:

  * Params: `{ id: number }`
  * Response: `{ artist, top_tracks, averages }`.

**3.3 Endpoints**

* `/playlists/:id/tracks`: raw SQL, join + filter by `energy >= energyMin`, aggregate artists, order by energy desc.
* `/artists/:id/summary`: raw SQL CTEs, top 5 tracks by popularity (in playlists), average audio features.

---

# 4) ClickHouse SQL (DDL + queries only)

**4.1 Materialized View**

* `ch/10_mv_artist_daily_aggr.sql`: AggregatingMergeTree table + MV from playlist\_track\_events.

**4.2 Queries** (`ch/20_queries.sql`)

* Query A: top artists last 30 days by uniqExact(track\_id), tie break avg popularity.
* Query B: per-playlist energy quantiles + topK(5) artists.
* Query C: top 5 artists *per day* by unique adds with window functions.

---

# 5) Tests (Jest + Fastify inject)

**5.1 Test harness**

* Use Jest runner.
* In integration tests, start Fastify instance, use `fastify.inject()` for requests.
* BeforeAll: run schema, ingest fixture.
* AfterAll: close pool + fastify.

**5.2 Unit test**

* Test helper like `makePlaceholders` for correctness.

**5.3 Integration tests**

* Ingest idempotency: run ingest twice, assert row counts unchanged.
* Playlist tracks: GET with energyMin, assert results sorted desc.
* Artist summary: GET, assert <=5 tracks and averages present.

---

# 6) DX & README

* `.nvmrc` ensures consistent Node version (`20`).
* README sections:

  * Setup with docker compose.
  * Running ingest.
  * Starting API.
  * Endpoints with curl examples.
  * Running tests.
  * Schema/index rationale.
  * ClickHouse files location.

