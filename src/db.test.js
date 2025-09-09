import assert from "node:assert/strict";
import test from "node:test";
import { pool, tx } from "./db.js";

test("tx commits and rollbacks appropriately", async (t) => {
	await t.test("commits and returns result on success", async () => {
		const originalConnect = pool.connect;
		let released = false;
		const calls = [];
		const client = {
			query: async (sql) => {
				calls.push(sql);
				return { rows: [], rowCount: 0 };
			},
			release: () => {
				released = true;
			},
		};

		pool.connect = async () => client;

		const result = await tx(async (c) => {
			assert.equal(c, client, "tx should pass the client to run");
			return 42;
		});

		assert.equal(result, 42);
		assert.deepEqual(calls, ["BEGIN", "COMMIT"]);
		assert.equal(released, true, "client should be released");

		pool.connect = originalConnect;
	});

	await t.test("rolls back and rethrows on failure", async () => {
		const originalConnect = pool.connect;
		let released = false;
		const calls = [];
		const client = {
			query: async (sql) => {
				calls.push(sql);
				return { rows: [], rowCount: 0 };
			},
			release: () => {
				released = true;
			},
		};

		pool.connect = async () => client;

		const err = new Error("boom");
		await assert.rejects(
			tx(async () => {
				throw err;
			}),
			err,
		);

		assert.deepEqual(calls, ["BEGIN", "ROLLBACK"]);
		assert.equal(released, true, "client should be released");

		pool.connect = originalConnect;
	});
});
