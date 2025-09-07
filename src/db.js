import dotenv from "dotenv";
import pg from "pg";

dotenv.config();
const DATABASE_URL = process.env.DATABASE_URL;

export const pool = new pg.Pool({ connectionString: DATABASE_URL });

export async function tx(run) {
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const res = await run(client);
		await client.query("COMMIT");
		return res;
	} catch (e) {
		await client.query("ROLLBACK");
		throw e;
	} finally {
		client.release();
	}
}
