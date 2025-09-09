-- Top 10 artists in last 30 days
WITH now() AS ts
SELECT
  artist_id,
  uniqExact(track_id) AS uniq_adds,
  avg(popularity) AS avg_popularity
FROM playlist_track_events
WHERE action = 'add'
  AND added_at >= (ts - INTERVAL 30 DAY)
-- might be useful to add a HAVING clause to filter out artists with very few adds
GROUP BY artist_id
-- tie breaker: higher average popularity
ORDER BY uniq_adds DESC, avg_popularity DESC
LIMIT 10;