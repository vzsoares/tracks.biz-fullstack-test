import "dotenv/config";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { pool, tx } from "./db.js";
import crypto from "crypto";

const BATCH_SIZE = 5;

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
		// TODO add more playlists in the fixture and batch it
		const playlistJson = JSON.parse(await fs.readFile(fromPath, "utf-8"));
		const featuresJson = JSON.parse(await fs.readFile(featuresPath, "utf-8"));

		const rash = crypto
			.createHash("sha256")
			.update(JSON.stringify(playlistJson))
			.digest("hex");
		const playlistRash = await tx(async (client) => {
			const res = await client.query(
				"SELECT snapshot FROM playlists WHERE id = $1",
				[playlistJson.id],
			);
			return res;
		});
		if (playlistRash?.rows?.[0]?.snapshot === rash) {
			console.log("Playlist already ingested and unchanged. Exiting.");
			return;
		}

		playlistJson.snapshot = rash;
		const context = { totalUpserted: 0 };
		const audio_features = featuresJson.audio_features;

		const normalizedData = normalizeData(playlistJson);

		await upsertData(normalizedData, context);
		await upsertData({ audio_features }, context);

		console.log(`Total rows upserted: ${context.totalUpserted}`);
		console.log("Ingestion complete!");
	} catch (error) {
		console.error("Ingestion failed:", error);
		process.exit(1);
	} finally {
		await pool.end();
	}
}

function normalizeData(playlistJson) {
	console.log("Normalizing data...");

	const playlist = {
		id: playlistJson.id,
		name: playlistJson.name,
		owner: playlistJson.owner,
		snapshot: playlistJson.snapshot,
	};

	// Map to avoid duplicates
	const artists = new Map();
	const albums = new Map();
	const tracks = [];
	const track_artists = [];
	const playlist_tracks = [];

	for (let i = 0; i < playlistJson.tracks.items.length; i++) {
		const item = playlistJson.tracks.items[i];
		const track = item.track;
		if (!track) continue;

		// Artists
		for (const artist of track.artists) {
			if (!artists.has(artist.id)) {
				artists.set(artist.id, {
					id: artist.id,
					name: artist.name,
					popularity: null,
					followers: null,
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
			added_by: item.added_by,
			position: i,
		});
	}

	return {
		playlists: [playlist],
		artists: Array.from(artists.values()),
		albums: Array.from(albums.values()),
		tracks,
		track_artists,
		playlist_tracks,
	};
}

async function upsertData(data, context) {
	console.log("Upserting data...");
	console.time("Total upsert duration");

	await tx(async (client) => {
		async function insert(table, columns, records, client, context) {
			if ((records?.length ?? 0) <= 0) return;

			const values = [];
			// This build a multi row insert statement with placeholders like ($1,$2,$3),($4,$5,$6),...
			const placeholders = records
				.map((row, i) => {
					const base = i * columns.length;
					values.push(...columns.map((c) => row[c]));
					return `(${columns.map((_, j) => `$${base + j + 1}`).join(",")})`;
				})
				.join(",");

			const query = `
    INSERT INTO ${table} (${columns.join(", ")})
    VALUES ${placeholders}
    ON CONFLICT DO NOTHING
  `;
			console.time(`Upsert ${table}`);
			const res = await client.query(query, values);
			console.timeEnd(`Upsert ${table}`);

			if (res.rowCount > 0) {
				console.log(`Upserted ${res.rowCount} rows into ${table}`);
			}
			context.totalUpserted = context.totalUpserted + res.rowCount;
		}

		await insert(
			"artists",
			["id", "name", "popularity", "followers"],
			data.artists,
			client,
			context,
		);
		await insert(
			"albums",
			["id", "name", "release_date", "album_type"],
			data.albums,
			client,
			context,
		);
		await insert(
			"tracks",
			["id", "name", "duration_ms", "explicit", "popularity", "album_id"],
			data.tracks,
			client,
			context,
		);
		await insert(
			"track_artists",
			["track_id", "artist_id"],
			data.track_artists,
			client,
			context,
		);
		await insert(
			"playlists",
			["id", "name", "owner", "snapshot"],
			data.playlists,
			client,
			context,
		);
		await insert(
			"playlist_tracks",
			["playlist_id", "track_id", "added_at", "added_by", "position"],
			data.playlist_tracks,
			client,
			context,
		);
		await insert(
			"audio_features",
			["track_id", "danceability", "energy", "key", "mode", "tempo", "valence"],
			data.audio_features,
			client,
			context,
		);
	});

	console.timeEnd("Total upsert duration");
}

main();
