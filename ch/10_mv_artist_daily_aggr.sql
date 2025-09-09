CREATE TABLE IF NOT EXISTS artist_daily_uniques
(
  event_date Date,
  artist_id String,
  unique_tracks_added AggregateFunction(uniqExact, String)
)
ENGINE = AggregatingMergeTree
ORDER BY (artist_id, event_date);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_artist_daily_aggr 
TO artist_daily_uniques 
AS
-- When i run this select by itself, it works fine
SELECT
    -- toDate returns YYYY-MM-DD
    toDate(added_at) AS event_date,
    artist_id,
    -- uniqExactState will ensure unique track_id values
    -- track_id must be unique because it's only added once
    uniqExactState(track_id) AS unique_tracks_added
FROM playlist_track_events
WHERE action = 'add'
GROUP BY event_date, artist_id;
