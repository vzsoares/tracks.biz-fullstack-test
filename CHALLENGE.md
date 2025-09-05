Take‑Home: Playlist Normalizer & Insights (Node.js \+ SQL \+ ClickHouse-lite)

\*\*Estimated time:\*\* 3–4 hours (core). ClickHouse tasks are \*SQL-only\* — you don’t need to run ClickHouse locally.

\#\# Goal

Build a tiny ETL \+ API that:

1\) Ingests a Spotify‑like playlist fixture (JSON) into a normalized \*\*OLTP\*\* DB (Postgres or MySQL).

2\) Exposes two read endpoints that use \*\*non-trivial SQL\*\*.

3\) Write \*\*ClickHouse\*\* DDL \+ queries (no runtime needed) that demonstrate OLAP thinking.

You can pick \*\*Postgres\*\* or \*\*MySQL\*\*. Use Node.js (LTS). ORM optional, but at least one endpoint must use \*\*raw SQL\*\*.

\---

\#\# What to implement

\#\#\# 1\) Schema (OLTP)

Create tables for:

\- \`artists\` (id, name, popularity, followers)

\- \`albums\` (id, name, release\_date, album\_type)

\- \`tracks\` (id, name, duration\_ms, explicit, popularity, album\_id)

\- \`playlists\` (id, name, owner, snapshot)

\- \`playlist\_tracks\` (playlist\_id, track\_id, added\_at, added\_by, position)

\- \`audio\_features\` (track\_id, danceability, energy, tempo, key, mode, valence)

\*\*Requirements\*\*

\- Primary/foreign keys, sensible \`NOT NULL\` & \`CHECK\` constraints.

\- Idempotent \*\*upserts\*\* (re-runs don’t duplicate).

\- At least one composite \*\*UNIQUE\*\* (e.g., \`(playlist\_id, track\_id, position)\` or \`(playlist\_id, track\_id)\` depending on your policy).

\- Useful indexes (justify in README).

\#\#\# 2\) Ingest CLI

A Node script that accepts a path to the fixture and writes normalized rows to your DB \*\*in transactional batches\*\* (configurable batch size).

\- Idempotent retries.

\- Basic logs: rows upserted, duration.

\- Handle: duplicate tracks in a playlist, tracks with missing audio\_features.

Run: \`node src/ingest/ingest.js \--from fixtures/playlist.basic.json \--features fixtures/audio\_features.json\`

\#\#\# 3\) API (read-only)

Expose two endpoints:

\- \`GET /playlists/:id/tracks?energyMin=0.7\`  

  Returns tracks in a playlist with \`audio\_features.energy \>= energyMin\`, ordered by \`energy DESC\`, with embedded artist \+ album objects.

\- \`GET /artists/:id/summary\`  

  Returns the artist row, \*\*top 5 tracks by popularity\*\* (within ingested playlists), and average audio feature values across those tracks.

\*\*SQL requirements\*\*

\- At least \*\*one endpoint\*\* must use \*\*raw SQL\*\* with a join \+ aggregation (window function or JSON aggregation is a plus).

\#\#\# 4\) ClickHouse (no runtime required)

Write SQL files only (place in \`ch/\`), using the provided table:

\`\`\`sql

\-- ch/00\_schema.sql (given to you below as reference)

CREATE TABLE playlist\_track\_events

(

  playlist\_id String,

  track\_id    String,

  artist\_id   String,

  added\_at    DateTime,

  action      Enum8('add' \= 1, 'remove' \= 2),

  popularity  UInt16,

  energy      Float32

)

ENGINE \= MergeTree

PARTITION BY toYYYYMM(added\_at)

ORDER BY (playlist\_id, track\_id, added\_at);

\`\`\`

\*\*Tasks\*\*

\- \`ch/10\_mv\_artist\_daily\_aggr.sql\`: A \*\*Materialized View\*\* that produces a daily aggregate of \*\*unique tracks added per artist\*\*, storing to an AggregatingMergeTree table.

\- \`ch/20\_queries.sql\`:  

  \- Query A: \*\*Top artists in the last 30 days\*\* by \`uniqExact(track\_id)\` adds with a tie-breaker on average popularity.  

  \- Query B: \*\*Energy distribution per playlist\*\* using \`quantiles(0.25,0.5,0.9)\` and \`topK(5)\` artists.  

  \- Query C: A query using a \*\*window function\*\* (e.g., top‑5 artists \*per day\* by unique adds).

You can write these without running ClickHouse — focus on correctness and idiomatic ClickHouse usage.

\#\#\# 5\) Tests

Provide at least:

\- One unit test (e.g., backfill/transform helper).

\- One integration test that runs against your local DB and verifies:

  \- Ingest of the small fixture,

  \- \`/playlists/:id/tracks?energyMin=…\` returns expected count/order for fixture data,

  \- Ingest is idempotent (second run doesn’t increase counts).

\---

\#\# Getting started

1\. Copy \`.env.example\` → \`.env\` and set DB creds (choose postgres or mysql).  

2\. Create DB and run the schema for your engine:

   \- Postgres: \`psql \-f db/postgres/schema.sql\`

   \- MySQL: \`mysql \< db/mysql/schema.sql\`

3\. Install deps: \`npm install\`

4\. Run ingest:

   \`\`\`bash

   node src/ingest/ingest.js \--from fixtures/playlist.basic.json \--features fixtures/audio\_features.json

   \`\`\`

5\. Start API:

   \`\`\`bash

   node src/api/server.js

   \`\`\`

6\. Run tests:

   \`\`\`bash

   npm test

   \`\`\`

\> You may replace the DB client or add an ORM if you prefer. Keep at least one raw SQL query in an endpoint.

\---

\#\# What we’re evaluating

\- Schema quality & constraints

\- Idempotent batching & upserts

\- SQL competence (joins, filters, ordering; bonus for windows/JSON agg)

\- Clear code structure and docs

\- ClickHouse literacy via DDL \+ queries

Good luck\! :)

