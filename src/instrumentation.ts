/**
 * Next.js-Instrumentierung: Läuft einmalig beim Start des (eingebetteten)
 * Servers - sowohl in `next dev` als auch im Standalone-Build der Desktop-
 * App. Kein Request-Kontext, keine UI.
 *
 * Aufgabe: Bestandsmigrationen, die kein Request auslösen muss:
 * 1. Klartext-Dateien in files/ verschlüsseln (idempotent, pro Datei atomar;
 *    siehe src/lib/file-crypto.ts).
 * 2. Klartext-Geheimnisse in app_settings verschlüsseln (Installationen von
 *    vor der Feldverschlüsselung; siehe src/data/app-settings.ts).
 *
 * Läuft bewusst asynchron im Hintergrund (blockiert den Server-Start nicht).
 * Der Lesepfad (src/lib/storage.ts) kann jederzeit beide Formate verarbeiten,
 * daher ist die Reihenfolge zu eingehenden Requests unkritisch.
 */
export async function register(): Promise<void> {
	if (process.env.NEXT_RUNTIME !== "nodejs") return;

	// Lazy imports: Die Module dürfen nicht im Edge-/Build-Kontext geladen
	// werden (Dateisystem, better-sqlite3).
	const { encryptPlaintextFilesInTree } = await import("./lib/file-crypto");
	const { ensureSecretsEncrypted } = await import("./data/app-settings");

	try {
		const migratedSecrets = ensureSecretsEncrypted();
		if (migratedSecrets > 0) {
			console.info(`Datenverschlüsselung: ${migratedSecrets} Geheimnis(se) in app_settings nachträglich verschlüsselt.`);
		}
		const result = await encryptPlaintextFilesInTree();
		if (result.encrypted > 0 || result.failed.length > 0) {
			console.info(
				`Datenverschlüsselung: ${result.encrypted} Datei(en) nachträglich verschlüsselt, ` +
					`${result.failed.length} Fehler (${result.scanned} geprüft).`
			);
			if (result.failed.length > 0) {
				console.error("Datenverschlüsselung: fehlgeschlagene Dateien", result.failed);
			}
		}
	} catch (error) {
		// Nie den Server-Start blockieren - Lesepfade sind abwärtskompatibel,
		// der nächste Start versucht die Migration erneut.
		console.error("Bestandsmigration der Datenverschlüsselung fehlgeschlagen", error);
	}
}
