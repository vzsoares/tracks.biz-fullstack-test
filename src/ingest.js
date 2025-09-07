import "dotenv/config";
import { promises as fs } from "node:fs";
import { resolve } from 'node:path';
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { pool } from "./db.js";

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

		// TODO: Normalize the data into artists, albums, tracks, etc.
		const normalizedData = normalizeData(playlistJson, featuresJson);

		// 2. Upsert data in transactional batches
		await upsertData(normalizedData, batchSize);

		console.log("Ingestion complete!");
	} catch (error) {
		console.error("Ingestion failed:", error);
		process.exit(1);
	} finally {
		await pool.close();
	}
}

function normalizeData(playlistJson, featuresJson) {
	// TODO: Implement normalization logic
	// - Extract artists, albums, tracks, track_artists, playlist, playlist_tracks
	// - Create a map of audio features by track_id
	console.log("Normalizing data...");
	return {};
}

async function upsertData(data, batchSize) {
	// TODO: Implement transactional batched upserts
	// - Use db.transaction from src/db.js
	// - Use ON CONFLICT DO UPDATE for upserts
	// - Handle missing audio features
	console.log("Upserting data...");
	const client = await pool.getClient();
	try {
		// Example of a transaction
		await pool.transaction(client, async (tx) => {
			// Your upsert logic here
		});
	} finally {
		client.release();
	}
}

main();
