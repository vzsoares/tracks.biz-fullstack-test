import { tx } from "../db.js";

async function playlistRoutes(fastify) {
	const schema = {
		params: {
			type: "object",
			properties: {
				id: { type: "number" },
			},
		},
		querystring: {
			type: "object",
			properties: {
				energyMin: { type: "number", default: 0, minimum: 0, maximum: 1 },
			},
		},
		response: {
			200: {
				type: "array",
				items: {
					type: "object",
					properties: {
						id: { type: "number" },
						name: { type: "string" },
						popularity: { type: "number" },
						energy: { type: "number" },
						artists: {
							type: "array",
							items: {
								type: "object",
								properties: {
									id: { type: "number" },
									name: { type: "string" },
								},
							},
						},
					},
				},
			},
		},
	};

	fastify.get("/playlists/:id/tracks", { schema }, async (request, reply) => {
		const { id } = request.params;
		const { energyMin } = request.query;

		try {
			const result = await tx(async (client) => {
				const { rows } = await client.query(
					`
        SELECT
          t.id,
          t.name,
          t.popularity,
          af.energy,
          json_agg(json_build_object('id', a.id, 'name', a.name)) as artists
        FROM
          playlist_tracks pt
        JOIN
          tracks t ON pt.track_id = t.id
        JOIN
          audio_features af ON t.id = af.track_id
        JOIN
          track_artists ta ON t.id = ta.track_id
        JOIN
          artists a ON ta.artist_id = a.id
        WHERE
          pt.playlist_id = $1
          AND af.energy >= $2
        GROUP BY
          t.id, af.energy
        ORDER BY
          af.energy DESC
        `,
					[id, energyMin],
				);
				return rows;
			});
			reply.code(200).send(result);
		} catch (e) {
			reply.code(500).send({ error: e.message });
		}
	});
}

export default playlistRoutes;
