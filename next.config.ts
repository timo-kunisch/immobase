import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Standalone-Output für die Einbettung in die Electron-Desktop-App: Der
	// Electron-Main-Prozess startet den Next.js-Server aus
	// .next/standalone heraus (siehe electron/main/server.ts).
	output: "standalone",
	// better-sqlite3 ist ein natives Modul und darf nicht vom Next-Bundler
	// verpackt werden (wird zur Laufzeit per require geladen).
	// pdfjs-dist wird ebenfalls nicht gebündelt: Die Engine lädt ihre
	// Worker-Datei (pdf.worker.mjs) zur Laufzeit per Dateipfad nach - im
	// gebündelten Chunk stimmt dieser Pfad nicht (HTTP 500 "Setting up fake
	// worker failed: Cannot find module .../chunks/pdf.worker.mjs"). Als
	// externes Paket liegt sie im Standalone-node_modules und wird über
	// outputFileTracingIncludes mit ins Paket genommen (siehe unten).
	serverExternalPackages: ["better-sqlite3", "pdfjs-dist"],
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
	// resources/standalone/node_modules/better-sqlite3) bereitgestellt; der
	// im Trace enthaltene Build wäre ein Node-ABI-Binary und würde in der
	// Electron-Laufzeit abstürzen. Der Turbopack-Standalone-Output enthält
	// für das externalisierte Paket nur einen gehashten Symlink
	// (.next/node_modules/better-sqlite3-<hash> -> ../../node_modules/
	// better-sqlite3) - das extraResources-Ziel macht genau dieses
	// Symlink-Ziel im Paket real. Für lokale Standalone-Tests (node
	// .next/standalone/server.js) muss das Ziel analog gelegt werden, z. B.
	// ln -s ../../node_modules/better-sqlite3 .next/standalone/node_modules/better-sqlite3
	//
	// Turbopack ueber-traced bei Routen mit Dateisystem-/Stream-Zugriff
	// (storage/backup/pdf) das KOMPLETTE Projektverzeichnis - inkl.
	// dist/, sodass jeder Build die Artefakte aller vorherigen Builds
	// rekursiv in den Standalone-Output (und damit ins Electron-Paket)
	// einbettet. Diese Pfade werden zur Laufzeit nicht benoetigt: Der
	// Server laeuft aus den kompilierten Chunks unter .next/server,
	// statische Assets und public/ kommen via extraResources ins Paket.
	outputFileTracingExcludes: {
		"*": [
			"./node_modules/better-sqlite3/**/*",
			"node_modules/better-sqlite3/**/*",
			"./dist/**/*",
			"dist/**/*",
			"./dist-electron/**/*",
			"dist-electron/**/*",
			"./electron/**/*",
			"electron/**/*",
			"./scripts/**/*",
			"scripts/**/*",
			"./src/**/*",
			"src/**/*",
			"./public/**/*",
			"public/**/*",
			"./build/**/*",
			"build/**/*",
			"./.github/**/*",
			".github/**/*",
			// Durch das oben beschriebene Ueber-Tracing landet auch die
			// Root-Config selbst in der NFT-Liste - Turbopack wertet genau
			// diese Datei als Kanarienvogel und warnt mit "Encountered
			// unexpected file in NFT list". Wird zur Laufzeit nicht benoetigt
			// (der Standalone-Server ist bereits kompiliert).
			"./next.config.ts",
			"next.config.ts",
		],
	},
	// Der Turbopack-Standalone-Trace verfehlt das Turbo-Runtime-Modul fuer
	// App-Routen (app-route-turbo.runtime.prod.js) - es wird nicht in die
	// nft.json aufgenommen, obwohl die Route es zur Laufzeit benoetigt.
	// Das fuehrt im Standalone/Electron zu "Cannot find module" (HTTP 500).
	// Explizit aufnehmen:
	outputFileTracingIncludes: {
		"/api/**": ["./node_modules/next/dist/compiled/next-server/app-route-turbo.runtime.prod.js"],
		// pdfjs-dist ist externalisiert (siehe serverExternalPackages): Der
		// Turbopack-NFT-Trace erfasst das Paket nicht vollständig - ohne diese
		// Angabe fehlen build-/worker-Dateien im gepackten Standalone und die
		// PDF-Extraktion schlägt mit "Cannot find module pdf.worker.mjs" fehl.
		// Bewusst nur die benötigten Dateien (Hauptmodul + Worker, jeweils
		// flache Bundles; keine .map/.min-Varianten) - das komplette Paket
		// würde den Standalone um ~40 MB aufblähen.
		"/api/chat": [
			"./node_modules/pdfjs-dist/package.json",
			"./node_modules/pdfjs-dist/legacy/build/pdf.mjs",
			"./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
		],
	},
};

export default nextConfig;
