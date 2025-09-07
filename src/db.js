import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

export const pool = new pg.Pool({
  user: process.env.POSTGRES_USER,
  host: 'localhost',
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: 5432,
});

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