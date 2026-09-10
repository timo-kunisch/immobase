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
	// Der OCR-Stack (tesseract.js + @napi-rs/canvas + das deutsche
	// Sprachmodell) ist aus demselben Grund externalisiert: tesseract.js
	// spannt zur Laufzeit einen worker_thread aus einer Skriptdatei im
	// node_modules-Baum auf und lädt WASM/Sprachdaten per fs-Pfad - beides
	// muss als echte Datei im Standalone-node_modules liegen.
	serverExternalPackages: ["better-sqlite3", "pdfjs-dist", "tesseract.js", "@napi-rs/canvas", "@tesseract.js-data/deu"],
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
			// tesseract.js-core: Die Core-Auswahl liegt bei tesseract.js
			// (worker-script/node/getCore.js). WICHTIG: In tesseract.js 7.0.0
			// prüft getCore den übergebenen lstmOnly-BOOLEAN gegen die
			// OEM-ENUM-Werte (immer false) und lädt dadurch IMMER eine
			// Nicht-LSTM-Variante (relaxedsimd > simd > plain) - die
			// LSTM-spezifischen Builds sind in 7.0.0 unerreichbarer Code und
			// werden hier ausgeschlossen (bei einem tesseract.js-Upgrade
			// prüfen, welche Varianten getCore wirklich require()t).
			// Hinweis: Die ebenfalls ungenutzten Single-File-Varianten
			// *.wasm.js (WASM base64-inline, ~11 MB) lassen sich über
			// outputFileTracingExcludes NICHT entfernen - Turbopack wendet
			// Datei-Ausschlüsse an dieser Stelle (Stand 16.2) nicht an;
			// sie sind harmlos, werden aber nie require()d.
			"./node_modules/tesseract.js-core/tesseract-core.asm.js",
			"node_modules/tesseract.js-core/tesseract-core.asm.js",
			"./node_modules/tesseract.js-core/tesseract-core-lstm.js",
			"node_modules/tesseract.js-core/tesseract-core-lstm.js",
			"./node_modules/tesseract.js-core/tesseract-core-lstm.wasm",
			"node_modules/tesseract.js-core/tesseract-core-lstm.wasm",
			"./node_modules/tesseract.js-core/tesseract-core-simd-lstm.js",
			"node_modules/tesseract.js-core/tesseract-core-simd-lstm.js",
			"./node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm",
			"node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm",
			"./node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.js",
			"node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.js",
			"./node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm",
			"node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm",
			// Deutsches Sprachmodell: Die index.js des Pakets referenziert
			// auch die Legacy+Cube-Variante 4.0.0 (path.join im Paket) - sie
			// wird mit OEM.LSTM_ONLY nie geladen (6,8 MB totes Gewicht).
			"./node_modules/@tesseract.js-data/deu/4.0.0/**/*",
			"node_modules/@tesseract.js-data/deu/4.0.0/**/*",
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
			// OCR-Stack (src/lib/ai/ocr.ts, lazy geladen): tesseract.js spannt
			// einen worker_thread aus src/worker-script/node/index.js auf und
			// lädt die WASM-Engine + das deutsche Sprachmodell per fs-Pfad -
			// die Dateien müssen im Standalone-node_modules real vorliegen.
			// Von tesseract.js-core die drei Varianten, die getCore in
			// tesseract.js 7.0.0 tatsächlich require()t (siehe Ausschluss-
			// Kommentar oben: dort werden aktuell immer die Nicht-LSTM-
			// Builds geladen, Auswahl per wasm-feature-detect).
			"./node_modules/tesseract.js/**",
			"./node_modules/tesseract.js-core/index.js",
			"./node_modules/tesseract.js-core/package.json",
			"./node_modules/tesseract.js-core/tesseract-core.js",
			"./node_modules/tesseract.js-core/tesseract-core.wasm",
			"./node_modules/tesseract.js-core/tesseract-core-simd.js",
			"./node_modules/tesseract.js-core/tesseract-core-simd.wasm",
			"./node_modules/tesseract.js-core/tesseract-core-relaxedsimd.js",
			"./node_modules/tesseract.js-core/tesseract-core-relaxedsimd.wasm",
			"./node_modules/wasm-feature-detect/**",
			"./node_modules/bmp-js/**",
			"./node_modules/is-url/**",
			"./node_modules/zlibjs/**",
			"./node_modules/idb-keyval/**",
			"./node_modules/regenerator-runtime/**",
			"./node_modules/node-fetch/**",
			"./node_modules/whatwg-url/**",
			"./node_modules/tr46/**",
			"./node_modules/webidl-conversions/**",			// Deutsches Sprachmodell: nur die LSTM-Variante best_int (kleinste
			// und für LSTM_ONLY genaueste; 4.0.0 mit Legacy+Cube wird nie
			// geladen, siehe src/lib/ai/ocr.ts).
			"./node_modules/@tesseract.js-data/deu/package.json",
			"./node_modules/@tesseract.js-data/deu/index.js",
			"./node_modules/@tesseract.js-data/deu/4.0.0_best_int/**",
			// @napi-rs/canvas: JS-Teil + das N-API-Binary der jeweiligen
			// Plattform (optionalDependencies - auf dem Build-Runner liegt
			// nur die Paketvariante der eigenen Plattform vor, die anderen
			// Muster greifen dann schlicht nicht).
			"./node_modules/@napi-rs/canvas/**",
			"./node_modules/@napi-rs/canvas-darwin-arm64/**",
			"./node_modules/@napi-rs/canvas-darwin-x64/**",
			"./node_modules/@napi-rs/canvas-linux-x64-gnu/**",
			"./node_modules/@napi-rs/canvas-win32-x64-msvc/**",
		],
	},
};

export default nextConfig;
