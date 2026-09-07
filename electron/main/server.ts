import fs from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";

import { log } from "./log";

/**
 * Startet den Next.js-Standalone-Server in-process (im Electron-Main-
 * Prozess) und - im Host-Modus - zusätzlich einen Token-geschützten
 * LAN-Proxy.
 *
 * Architektur:
 * - Der Next-Server bindet IMMER nur an 127.0.0.1 (Loopback) mit dynamischem
 *   Port (bevorzugt der zuletzt verwendete Port - Stabilität für absolute
 *   Links in Transaktions-Mails -, sonst Port 0 = freie Wahl durch das OS).
 *   Der tatsächliche Port wird nach listen() aus server.address() gelesen,
 *   nichts ist hartcodiert.
 * - Im Host-Modus lauscht zusätzlich ein schlanker HTTP-Proxy auf
 *   0.0.0.0:<hostPort>: Er erzwingt das Zugangs-Token (Header "x-iv-token"
 *   oder Cookie "iv_host_token") für ALLE Requests und reicht sie dann an
 *   den Loopback-Next-Server weiter. So liegt die Autorisierung an genau
 *   einer Stelle mit Zugriff auf die Peer-IP (die Next-Middleware sieht sie
 *   nicht) und der Next-Server selbst bleibt unverändert.
 *
 * Voraussetzung: Vor dem Aufruf muss process.env.APP_DATA_DIR gesetzt sein
 * (Datenablage-Pfade, siehe src/data/paths.ts).
 */

export interface RunningServer {
	/** URL für das lokale BrowserWindow (Loopback, ohne Token). */
	localUrl: string;
	/** LAN-URL für Clients (nur Host-Modus), inkl. Port. */
	lanUrl: string | null;
	port: number;
	hostPort: number | null;
	close(): Promise<void>;
}

interface StartServerOptions {
	standaloneDir: string;
	preferredPort: number | null;
	preferredHostPort: number | null;
	hostMode: boolean;
	hostToken: string | null;
	dataDir: string;
	appVersion: string;
}

interface NextServerLike {
	prepare(): Promise<void>;
	getRequestHandler(): (req: http.IncomingMessage, res: http.ServerResponse) => void | Promise<void>;
	close?(): Promise<void>;
}

function loadNextFactory(standaloneDir: string): (options: Record<string, unknown>) => NextServerLike {
	// Der Standalone-Build enthält seine eigene, getracete node_modules-
	// Struktur; Auflösung relativ zu server.js (createRequire), damit exakt
	// die mitgelieferte Next-Version geladen wird.
	const requireFromStandalone = createRequire(path.join(standaloneDir, "server.js"));

	// Konfiguration aus dem Build übernehmen (enthält u. a. die
	// serverActions-Limits) - analog zum generierten server.js.
	const requiredServerFiles = JSON.parse(
		fs.readFileSync(path.join(standaloneDir, ".next", "required-server-files.json"), "utf8")
	) as { config: Record<string, unknown> };
	process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(requiredServerFiles.config);

	const mod = requireFromStandalone("next") as unknown;
	const factory = (mod as { default?: unknown }).default ?? mod;
	if (typeof factory !== "function") {
		throw new Error("Die Next.js-Laufzeit im Standalone-Build hat kein erwartetes Factory-Export.");
	}
	return factory as (options: Record<string, unknown>) => NextServerLike;
}

function listen(server: http.Server, port: number, hostname: string): Promise<number> {
	return new Promise((resolve, reject) => {
		const onError = (error: NodeJS.ErrnoException): void => {
			server.removeListener("listening", onListening);
			reject(error);
		};
		const onListening = (): void => {
			server.removeListener("error", onError);
			const address = server.address();
			if (address && typeof address === "object") resolve(address.port);
			else reject(new Error("Port konnte nach listen() nicht ermittelt werden."));
		};
		server.once("error", onError);
		server.once("listening", onListening);
		server.listen(port, hostname);
	});
}

/** Bindet auf den Wunschport, fällt bei Kollision auf Port 0 (freie Wahl) zurück. */
async function listenWithFallback(server: http.Server, preferredPort: number | null, hostname: string): Promise<number> {
	if (preferredPort) {
		try {
			return await listen(server, preferredPort, hostname);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE" && (error as NodeJS.ErrnoException).code !== "EACCES") {
				throw error;
			}
			log.warn(`Port ${preferredPort} belegt - weiche auf einen freien Port aus.`);
		}
	}
	return listen(server, 0, hostname);
}

function isLoopback(address: string | undefined): boolean {
	if (!address) return true;
	return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function extractToken(req: http.IncomingMessage): string | null {
	const header = req.headers["x-iv-token"];
	if (typeof header === "string" && header) return header;
	const cookieHeader = req.headers.cookie;
	if (cookieHeader) {
		for (const part of cookieHeader.split(";")) {
			const [name, ...rest] = part.trim().split("=");
			if (name === "iv_host_token") return decodeURIComponent(rest.join("="));
		}
	}
	return null;
}

/**
 * Erstellt den LAN-Proxy (Host-Modus): Token-Check + streaming-Weiterleitung
 * an den Loopback-Next-Server.
 */
function createLanProxy(targetPort: number, hostToken: string): http.Server {
	return http.createServer((req, res) => {
		// Loopback-Zugriffe auf den Proxy (z. B. Diagnose am Host selbst) sind
		// ohne Token erlaubt; alle anderen benötigen das Zugangs-Token.
		if (!isLoopback(req.socket.remoteAddress) && extractToken(req) !== hostToken) {
			res.writeHead(401, { "Content-Type": "text/plain; charset=utf-8" });
			res.end("Nicht autorisiert - gueltiges Zugangs-Token erforderlich.");
			return;
		}

		const upstream = http.request(
			{
				host: "127.0.0.1",
				port: targetPort,
				path: req.url,
				method: req.method,
				headers: { ...req.headers, host: `127.0.0.1:${targetPort}` },
			},
			(upstreamRes) => {
				res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
				upstreamRes.pipe(res);
			}
		);
		upstream.on("error", (error) => {
			log.error("LAN-Proxy: Upstream-Fehler", error);
			if (!res.headersSent) res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
			res.end("Der lokale Server ist nicht erreichbar.");
		});
		req.pipe(upstream);
	});
}

export async function startEmbeddedServer(options: StartServerOptions): Promise<RunningServer> {
	const { standaloneDir, hostMode, hostToken, dataDir, appVersion } = options;

	if (!fs.existsSync(path.join(standaloneDir, "server.js"))) {
		throw new Error(`Standalone-Build nicht gefunden unter ${standaloneDir} - bitte zuerst "npm run build" ausfuehren.`);
	}

	// Umgebung für die Server-App (wird von src/data/paths.ts,
	// src/lib/email/mailer.ts etc. gelesen). APP_URL wird erst NACH dem
	// Binden gesetzt (Port steht dann fest); die Mailer-Implementierung liest
	// die Variable erst zum Versandzeitpunkt.
	process.env.APP_DATA_DIR = dataDir;
	process.env.APP_VERSION = appVersion;
	// NODE_ENV ist im Electron-Main bereits "production" (gesetzt vom
	// Packager/Runtime); kein erneutes Setzen nötig (read-only im TS-Typ).

	const nextFactory = loadNextFactory(standaloneDir);
	const app = nextFactory({ dev: false, dir: standaloneDir, hostname: "127.0.0.1", port: 0 });
	await app.prepare();
	const handler = app.getRequestHandler();

	const nextServer = http.createServer((req, res) => {
		void handler(req, res);
	});
	const port = await listenWithFallback(nextServer, options.preferredPort, "127.0.0.1");
	const localUrl = `http://127.0.0.1:${port}`;
	process.env.APP_URL = localUrl;
	log.info(`Next.js-Server laeuft auf ${localUrl} (Daten: ${dataDir})`);

	let lanUrl: string | null = null;
	let hostPort: number | null = null;
	let proxy: http.Server | null = null;

	if (hostMode) {
		if (!hostToken) throw new Error("Host-Modus ohne Host-Token gestartet - interner Fehler.");
		proxy = createLanProxy(port, hostToken);
		hostPort = await listenWithFallback(proxy, options.preferredHostPort, "0.0.0.0");
		lanUrl = `http://0.0.0.0:${hostPort}`;
		log.info(`Host-Modus: LAN-Proxy auf Port ${hostPort} (Token-geschuetzt)`);
	}

	return {
		localUrl,
		lanUrl,
		port,
		hostPort,
		close: async () => {
			await Promise.all([
				new Promise<void>((resolve) => nextServer.close(() => resolve())),
				proxy ? new Promise<void>((resolve) => proxy.close(() => resolve())) : Promise.resolve(),
			]);
			if (app.close) await app.close();
		},
	};
}
