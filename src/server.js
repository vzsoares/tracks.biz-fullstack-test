import fastify from "fastify";
import artists from "./api/artists.js";
import playlists from "./api/playlists.js";

const app = fastify({ logger: true });

app.register(playlists);
app.register(artists);

app.get("/health", async () => {
	return { status: "ok" };
});

function start() {
	try {
		app.listen({ port: process.env.PORT || 3000 });
	} catch (err) {
		app.log.error(err);
		process.exit(1);
	}
}

start();
