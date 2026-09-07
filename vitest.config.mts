import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Testumgebung für reine Unit-Tests von Server-seitigem Code (kein DOM,
 * kein echter Netzwerkzugriff). Externe
 * Abhängigkeiten (z. B. fetch() gegen die LetterXpress-API) werden in den
 * jeweiligen Testdateien gemockt (siehe src/lib/letterxpress.test.ts).
 */
export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
		setupFiles: ["./src/test/setup.ts"],
	},
	resolve: {
		alias: {
			"@": path.resolve(rootDir, "./src"),
			"server-only": path.resolve(rootDir, "./src/test/server-only-stub.ts"),
		},
	},
});
