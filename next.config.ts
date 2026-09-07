import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Standalone-Output für die Einbettung in die Electron-Desktop-App: Der
	// Electron-Main-Prozess startet den Next.js-Server aus
	// .next/standalone heraus (siehe electron/main/server.ts).
	output: "standalone",
	// better-sqlite3 ist ein natives Modul und darf nicht vom Next-Bundler
	// verpackt werden (wird zur Laufzeit per require geladen).
	serverExternalPackages: ["better-sqlite3"],
	experimental: {
		serverActions: {
			// Next.js-Standardlimit ist 1 MB – für Dokumenten-/Fotouploads (DMS,
			// Übergabeprotokolle) auf 15 MB angehoben.
			bodySizeLimit: "15mb",
		},
	},
	// better-sqlite3 bewusst NICHT in den Standalone-Trace aufnehmen: Im
	// Electron-Packaging wird das native Binary gegen die Electron-ABI neu
	// gebaut und über electron-builder (extraResources ->
	// resources/node_modules/better-sqlite3) bereitgestellt; der im Trace
	// enthaltene Build wäre ein Node-ABI-Binary und würde in der
	// Electron-Laufzeit abstürzen. Für lokale Standalone-Tests (node
	// .next/standalone/server.js) löst der Node-Modulresolver automatisch
	// auf das Projekt-root node_modules auf (walk-up).
	outputFileTracingExcludes: {
		"*": ["./node_modules/better-sqlite3/**/*", "node_modules/better-sqlite3/**/*"],
	},
};

export default nextConfig;
