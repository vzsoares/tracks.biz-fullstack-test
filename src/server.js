import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fastify from "fastify";
import artists from "./api/artists.js";
import playlists from "./api/playlists.js";

const app = fastify({ logger: true });

app.register(swagger, {
	swagger: {
		info: {
			title: "Tracks.biz API",
			description: "API for tracks.biz",
			version: "0.1.0",
		},
		host: "localhost:3000",
		schemes: ["http"],
		consumes: ["application/json"],
		produces: ["application/json"],
	},
});

app.register(swaggerUi, {
	routePrefix: "/docs",
	uiConfig: {
		docExpansion: "full",
		deepLinking: false,
	},
});

app.register(playlists);
app.register(artists);

app.get("/health", async () => {
	return { status: "ok" };
});

async function start() {
	await app.ready();
	app.swagger();
	try {
		app.listen({ port: process.env.PORT || 3000 });
	} catch (err) {
		app.log.error(err);
		process.exit(1);
	}
}

start();
