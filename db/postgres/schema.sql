CREATE TABLE IF NOT EXISTS artists (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    popularity INT CHECK (popularity >= 0 AND popularity <= 100),
    followers BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS albums (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    release_date DATE,
    album_type VARCHAR(50),
    artist_id INT REFERENCES artists(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tracks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    duration_ms INT CHECK (duration_ms > 0),
    explicit BOOLEAN DEFAULT FALSE,
    popularity INT CHECK (popularity >= 0 AND popularity <= 100),
    album_id INT REFERENCES albums(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS playlists (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    -- TODO no context of what this is, might need to change
    owner VARCHAR(255),
    -- TODO no context of what this is, might need to change
    snapshot VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id INT REFERENCES playlists(id) ON DELETE CASCADE,
    track_id INT REFERENCES tracks(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    added_by VARCHAR(255),
    position INT CHECK (position >= 0),
    PRIMARY KEY (playlist_id, track_id)
);

CREATE TABLE IF NOT EXISTS audio_features (
    track_id INT PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
    danceability FLOAT CHECK (danceability >= 0 AND danceability <= 1),
    energy FLOAT CHECK (energy >= 0 AND energy <= 1),
    tempo FLOAT CHECK (tempo > 0),
    -- 'key' indicates Musical key of the track.
    -- -1 = no key detected
    -- 0 = C, 1 = C♯/D♭, 2 = D, ... 11 = B
    key INT CHECK (key >= 0 AND key <= 11),
    -- 'mode' indicates major (1) or minor (0) key.
    mode INT CHECK (mode IN (0, 1)),
    valence FLOAT CHECK (valence >= 0 AND valence <= 1)
);

-- Extra table
CREATE TABLE IF NOT EXISTS track_artists (
  track_id INT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  artist_id INT NOT NULL REFERENCES artists(id) ON DELETE RESTRICT,
  PRIMARY KEY (track_id, artist_id)
);

-- Efficiently get the most popular tracks without scanning/sorting the whole table
CREATE INDEX IF NOT EXISTS idx_tracks_popularity ON tracks(popularity DESC);
-- Quickly list all tracks linked to a specific artist.
CREATE INDEX IF NOT EXISTS idx_track_artists_artist_track ON track_artists(artist_id, track_id);
