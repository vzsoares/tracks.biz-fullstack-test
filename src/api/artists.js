import { tx } from "../db.js";

async function artistRoutes(fastify, options) {
	const schema = {
		params: {
			type: "object",
			properties: {
				id: { type: "number" },
			},
		},
		response: {
			200: {
				type: "object",
				properties: {
					artist: { type: "object" },
					top_tracks: { type: "array" },
					averages: { type: "object" },
				},
			},
		},
	};

	fastify.get("/artists/:id/summary", { schema }, async (request, reply) => {
		const { id } = request.params;

		try {
			const result = await tx(async (client) => {
				const { rows } = await client.query(
					`
        WITH top_tracks AS (
          SELECT
            t.id,
            t.name,
            t.popularity
          FROM
            tracks t
          JOIN
            track_artists ta ON t.id = ta.track_id
          WHERE
            ta.artist_id = $1
          ORDER BY
            t.popularity DESC
          LIMIT 5
        ),
        avg_features AS (
          SELECT
            avg(af.energy) as energy,
            avg(af.danceability) as danceability,
            avg(af.valence) as valence,
            avg(af.tempo) as tempo
          FROM
            audio_features af
          JOIN
            track_artists ta ON af.track_id = ta.track_id
          WHERE
            ta.artist_id = $1
        )
        SELECT
          (SELECT row_to_json(a.*) FROM artists a WHERE a.id = $1) as artist,
          (SELECT json_agg(tt.*) FROM top_tracks tt) as top_tracks,
          (SELECT row_to_json(af.*) FROM avg_features af) as averages
        `,
					[id],
				);
				return rows[0];
			});
			reply.code(200).send(result);
		} catch (e) {
			reply.code(500).send({ error: e.message });
		}
	});
}

export default artistRoutes;
