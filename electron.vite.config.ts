import { resolve } from "node:path";

import { defineConfig } from "electron-vite";

/**
 * electron-vite-Konfiguration: Es werden NUR Main- und Preload-Prozess
 * gebaut. Der Renderer ist die bestehende Next.js-App (wird vom
 * Main-Prozess als lokaler HTTP-Server gestartet und im BrowserWindow
 * geladen) - es gibt keinen eigenen Renderer-Build.
 */
export default defineConfig({
	main: {
		build: {
			outDir: "dist-electron/main",
			rollupOptions: {
				input: {
					index: resolve(__dirname, "electron/main/index.ts"),
				},
			},
		},
	},
	preload: {
		build: {
			outDir: "dist-electron/preload",
			rollupOptions: {
				input: {
					index: resolve(__dirname, "electron/preload/index.ts"),
				},
			},
		},
	},
});
