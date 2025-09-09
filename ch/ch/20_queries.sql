-- A) Top 10 artists in last 30 days
SELECT
  artist_id,
  uniqExact(track_id) AS uniq_adds,
  avg(popularity) AS avg_popularity
FROM playlist_track_events
WHERE action = 'add'
  AND added_at >= subtractDays(now(), 30)
-- might be useful to add a HAVING clause to filter out artists with very few adds
GROUP BY artist_id
-- tie breaker: higher average popularity
ORDER BY uniq_adds DESC, avg_popularity DESC
LIMIT 10;

-- B) Energy distribution per playlist
SELECT
  playlist_id,
  -- energy distribution
  quantiles(0.25, 0.5, 0.9)(energy) AS energy_quants,
  -- most frequent artists
  topK(5)(artist_id) AS top_artists
FROM playlist_track_events
WHERE action = 'add'
GROUP BY playlist_id
ORDER BY playlist_id;
