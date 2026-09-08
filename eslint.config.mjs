// Bewusst der direkte Flat-Config-Import statt FlatCompat.extends(...):
// FlatCompat (der ESLint-8-Kompatibilitäts-Layer) verursacht mit
// ESLint 9 + eslint-config-next 16 einen "Converting circular structure
// to JSON"-Fehler beim Validieren der react-Plugin-Config. Der direkte
// Import der bereits Flat-Config-nativen Presets aus eslint-config-next
// vermeidet FlatCompat vollständig und behebt den Fehler.
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
	...nextVitals,
	...nextTs,
	{
		rules: {
			// Dieses Projekt synchronisiert bewusst lokalen UI-State (z. B. das
			// Schließen eines Dialogs) mit dem Ergebnis von useActionState in
			// einem useEffect – ein laut React-Doku gültiges Muster ("Subscribe
			// for updates from some external system"). Die Regel schlägt sogar
			// im von shadcn/ui generierten "use-mobile"-Hook an, daher deaktiviert.
			"react-hooks/set-state-in-effect": "off",
			// Übliche Unterstrich-Konvention für bewusst ungenutzte Bezeichner
			// (z. B. einheitlich gebundene, aktuell ungenutzte Action-Parameter
			// wie `_hoaId` in den WEG-Modul-Actions oder `_prevState` in
			// useActionState-Actions). eslint-config-next setzt die Regel nur
			// auf "warn" ohne Optionen - hier um die Ignore-Muster ergänzt.
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{
					args: "after-used",
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
					destructuredArrayIgnorePattern: "^_",
				},
			],
		},
	},
	// Default ignores von eslint-config-next um Build-Ausgaben und generierte
	// Dateien ergänzen (analog zu .gitignore). electron/shell/*.html ist
	// bewusst plain JS ohne Build-Schritt.
	globalIgnores([
		".next/**",
		"out/**",
		"build/**",
		"dist/**",
		"dist-electron/**",
		"next-env.d.ts",
		"data-dev/**",
		"electron/shell/**",
	]),
]);

export default eslintConfig;
