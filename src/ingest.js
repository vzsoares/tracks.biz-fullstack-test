import "dotenv/config";
import { promises as fs } from "node:fs";
import { resolve } from 'node:path';
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { pool, tx } from "./db.js";

const BATCH_SIZE = process.env.BATCH_SIZE || 100;

async function main() {
	const argv = yargs(hideBin(process.argv))
		.option("from", {
			alias: "f",
			type: "string",
			description: "Path to the playlist JSON file",
			demandOption: true,
		})
		.option("features", {
			alias: "p",
			type: "string",
			description: "Path to the audio features JSON file",
			demandOption: true,
		})
		.option("batch", {
			alias: "b",
			type: "number",
			description: "Batch size for DB inserts",
			default: BATCH_SIZE,
		}).argv;

	const fromPath = resolve(argv.from);
	const featuresPath = resolve(argv.features);
	const batchSize = argv.batch;

	console.log(`Ingesting playlist from: ${fromPath}`);
	console.log(`With audio features from: ${featuresPath}`);
	console.log(`Batch size: ${batchSize}`);

	try {
		// 1. Parse & Normalize JSON files
		const playlistJson = JSON.parse(await fs.readFile(fromPath, "utf-8"));
		const featuresJson = JSON.parse(await fs.readFile(featuresPath, "utf-8"));

		const normalizedData = normalizeData(playlistJson, featuresJson);

		// 2. Upsert data in transactional batches
		await upsertData(normalizedData);

		console.log("Ingestion complete!");
	} catch (error) {
		console.error("Ingestion failed:", error);
		process.exit(1);
	} finally {
		await pool.end();
	}
}

function normalizeData(playlistJson, featuresJson) {
  console.log('Normalizing data...');

  const featuresMap = new Map(featuresJson.audio_features.map((f) => [f.id, f]));

  const playlist = {
    id: playlistJson.id,
    name: playlistJson.name,
    owner: playlistJson.owner.id,
    snapshot: playlistJson.snapshot_id,
  };

  const artists = new Map();
  const albums = new Map();
  const tracks = [];
  const track_artists = [];
  const playlist_tracks = [];
  const audio_features = [];

  for (const item of playlistJson.tracks.items) {
    const track = item.track;
    if (!track) continue;

    // Artists
    for (const artist of track.artists) {
      if (!artists.has(artist.id)) {
        artists.set(artist.id, {
          id: artist.id,
          name: artist.name,
          popularity: null, // Not available in this context
          followers: null, // Not available in this context
        });
      }
    }

    // Album
    if (track.album && !albums.has(track.album.id)) {
      albums.set(track.album.id, {
        id: track.album.id,
        name: track.album.name,
        release_date: track.album.release_date,
        album_type: track.album.album_type,
        artist_id: track.album.artists[0].id, // Assuming one artist per album for simplicity
      });
    }

    // Track
    tracks.push({
      id: track.id,
      name: track.name,
      duration_ms: track.duration_ms,
      explicit: track.explicit,
      popularity: track.popularity,
      album_id: track.album.id,
    });

    // Track-Artists
    for (const artist of track.artists) {
      track_artists.push({ track_id: track.id, artist_id: artist.id });
    }

    // Playlist-Tracks
    playlist_tracks.push({
      playlist_id: playlist.id,
      track_id: track.id,
      added_at: item.added_at,
      added_by: item.added_by.id,
      position: item.position, // Assuming position is available
    });

    // Audio Features
    if (featuresMap.has(track.id)) {
      const features = featuresMap.get(track.id);
      audio_features.push({
        track_id: track.id,
        ...features,
      });
    }
  }

  return {
    playlists: [playlist],
    artists: Array.from(artists.values()),
    albums: Array.from(albums.values()),
    tracks,
    track_artists,
    playlist_tracks,
    audio_features,
  };
}

async function upsertData(data) {
  console.log('Upserting data...');
  await tx(async (client) => {
    // Upsert artists
    for (const artist of data.artists) {
      await client.query(
        'INSERT INTO artists (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
        [artist.id, artist.name]
      );
    }

    // Upsert albums
    for (const album of data.albums) {
      await client.query(
        'INSERT INTO albums (id, name, release_date, album_type, artist_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
        [album.id, album.name, album.release_date, album.album_type, album.artist_id]
      );
    }

    // Upsert tracks
    for (const track of data.tracks) {
      await client.query(
        'INSERT INTO tracks (id, name, duration_ms, explicit, popularity, album_id) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
        [track.id, track.name, track.duration_ms, track.explicit, track.popularity, track.album_id]
      );
    }

    // Upsert track_artists
    for (const ta of data.track_artists) {
      await client.query(
        'INSERT INTO track_artists (track_id, artist_id) VALUES ($1, $2) ON CONFLICT (track_id, artist_id) DO NOTHING',
        [ta.track_id, ta.artist_id]
      );
    }

    // Upsert playlists
    for (const playlist of data.playlists) {
      await client.query(
        'INSERT INTO playlists (id, name, owner, snapshot) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
        [playlist.id, playlist.name, playlist.owner, playlist.snapshot]
      );
    }

    // Upsert playlist_tracks
    for (const pt of data.playlist_tracks) {
      await client.query(
        'INSERT INTO playlist_tracks (playlist_id, track_id, added_at, added_by, position) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (playlist_id, track_id) DO NOTHING',
        [pt.playlist_id, pt.track_id, pt.added_at, pt.added_by, pt.position]
      );
    }

    // Upsert audio_features
    for (const af of data.audio_features) {
      await client.query(
        'INSERT INTO audio_features (track_id, danceability, energy, key, mode, tempo, valence) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (track_id) DO NOTHING',
        [af.track_id, af.danceability, af.energy, af.key, af.mode, af.tempo, af.valence]
      );
    }
  });
}

main();
