import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { pool, tx } from "../src/db.js";

async function resetDb() {
	await tx(async (client) => {
		await client.query(`TRUNCATE TABLE 
      playlist_tracks,
      audio_features,
      track_artists,
      tracks,
      albums,
      artists,
      playlists
      RESTART IDENTITY CASCADE;`);
	});
}

function runIngest() {
	return new Promise((resolve, reject) => {
		const child = spawn(
			process.execPath,
			[
				"src/ingest.js",
				"--from",
				"fixtures/playlist.basic.json",
				"--features",
				"fixtures/audio_features.json",
			],
			{ stdio: "inherit", env: process.env },
		);
		child.on("exit", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`ingest exited with code ${code}`));
		});
		child.on("error", reject);
	});
}

async function waitForHealth(
	url = "http://localhost:3000/health",
	attempts = 30,
) {
	for (let i = 0; i < attempts; i++) {
		try {
			const res = await fetch(url);
			if (res.ok) return true;
		} catch {}
		await delay(200);
	}
	throw new Error("Server health check failed to become ready");
}

function startServer() {
	const child = spawn(process.execPath, ["src/api/server.js"], {
		stdio: "inherit",
		env: process.env,
	});
	return child;
}

async function stopServer(child) {
	if (!child) return;
	child.kill("SIGTERM");
	// small grace period
	await delay(200);
}

async function tableCounts() {
	const tables = [
		"artists",
		"albums",
		"tracks",
		"track_artists",
		"playlists",
		"playlist_tracks",
		"audio_features",
	];
	return await tx(async (client) => {
		const counts = {};
		for (const t of tables) {
			const { rows } = await client.query(
				`SELECT COUNT(*)::int as c FROM ${t}`,
			);
			counts[t] = rows[0].c;
		}
		return counts;
	});
}

test("integration: ingest + API + idempotency", async () => {
	await resetDb();

	// First ingest
	await runIngest();
	const afterFirst = await tableCounts();

	// Start server and wait until healthy
	const server = startServer();
	await waitForHealth();

	try {
		// energyMin=0.6 -> only track id 1 (energy 0.7)
		const res1 = await fetch(
			"http://localhost:3000/playlists/1/tracks?energyMin=0.6",
		);
		assert.equal(res1.ok, true, "GET /playlists/1/tracks should be OK");
		const json1 = await res1.json();
		assert.equal(Array.isArray(json1), true);
		assert.equal(json1.length, 1);
		assert.equal(json1[0].id, 1);
		assert.ok(json1[0].energy >= 0.6);

		// energyMin=0.5 -> track ids [1,2] ordered by energy desc
		const res2 = await fetch(
			"http://localhost:3000/playlists/1/tracks?energyMin=0.5",
		);
		assert.equal(res2.ok, true);
		const json2 = await res2.json();
		assert.equal(json2.length, 2);
		assert.deepEqual(
			json2.map((t) => t.id),
			[1, 2],
		);
		assert.ok(json2[0].energy >= json2[1].energy);
	} finally {
		await stopServer(server);
	}

	// Second ingest (idempotent)
	await runIngest();
	const afterSecond = await tableCounts();

	assert.deepEqual(
		afterSecond,
		afterFirst,
		"Counts should be unchanged after re-ingest",
	);
	// Close test process pool to avoid open handle
	await pool.end();
});
