import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { finished } from "node:stream/promises";

import archiver from "archiver";
import BetterSqlite3 from "better-sqlite3";
import yauzl from "yauzl";

import { closeDb, getDb } from "./db";
import { LATEST_SCHEMA_VERSION, migrateDatabase } from "./migrate";
import { getDataDir, getDatabaseFilePath, getFilesDir } from "./paths";

/**
 * Backup-Export/-Import der kompletten Anwendungsdaten.
 *
 * Export-Format (eine ZIP-Datei):
 * - `manifest.json`  – App-Name, App-Version, schemaVersion (= PRAGMA
 *   user_version der DB), Zeitstempel sowie SHA-256-Prüfsumme + Größe JEDER
 *   enthaltenen Datei.
 * - `data.db`        – konsistenter SQLite-Datenbankstand, erzeugt
 *   AUSSCHLIESSLICH über die SQLite-Backup-API (`db.backup()`), niemals
 *   per fs.copyFile (WAL-Konsistenz).
 * - `files/...`      – die Upload-/Generat-Dateien inkl. Sidecar-Metadaten.
 *
 * Streaming: Der Export nutzt `archiver` (Streams, kein Vollpuffer) und
 * funktioniert damit auch mit mehreren GB großen `files/`-Verzeichnissen.
 * Hinweis zur IO-Last: Prüfsummen und ZIP-Komprimierung laufen in zwei
 * Lesepässen über die Dateien (erst hashen, dann komprimieren) - korrekt
 * und einfach; bei sehr großen Beständen dauert der Export entsprechend.
 *
 * Import:
 * - validiert Manifest + sämtliche SHA-256-Prüfsummen,
 * - prüft schemaVersion (älter -> wird nach dem Einspielen automatisch
 *   migriert; NEUER -> klar abgelehnt),
 * - legt vorher ein Backup des Ist-Zustands an
 *   (`<dataDir>/backups/pre-import-<Zeitstempel>.zip`),
 * - arbeitet atomar: Entpacken in ein temp-Verzeichnis INNERHALB des
 *   Datenverzeichnisses (gleiches Dateisystem!) -> Validierung -> Umbenennen
 *   der Verzeichnisse -> bei Fehler vollständiger Rollback,
 * - Modi: "replace" (Ist-Zustand wird komplett ersetzt) und "merge"
 *   (Zusammenführen).
 *
 * KONFLIKTSTRATEGIE "merge": zeilenbasiert
 * pro Tabelle per `INSERT OR IGNORE` - existiert eine Zeile mit demselben
 * Primärschlüssel bereits, GEWINNT der lokale Bestand; nur neue Zeilen
 * werden übernommen. Dateien werden nur kopiert, wenn sie lokal noch nicht
 * existieren. Das ist bewusst einfach gehalten ("alte Sicherung ergänzen"),
 * KEIN Sync-Protokoll für parallele Mehrgeräte-Bearbeitung derselben Daten.
 * app_settings bleibt dabei immer lokal (INSERT OR IGNORE, lokaler
 * Primärschlüssel gewinnt).
 */

export interface BackupManifest {
	app: string;
	appVersion: string;
	schemaVersion: number;
	createdAt: string;
	files: { path: string; sha256: string; size: number }[];
}

export interface BackupExportResult {
	targetPath: string;
	fileCount: number;
	totalBytes: number;
}

export interface BackupImportResult {
	mode: "replace" | "merge";
	importedFiles: number;
	mergedRows?: Record<string, number>;
	backupPath: string | null;
}

const MANIFEST_NAME = "manifest.json";
const DB_ZIP_PATH = "data.db";
const APP_ID = "immobase";

// ------------------------------------------------------------
// Gemeinsame Hilfsfunktionen
// ------------------------------------------------------------

function getAppVersion(): string {
	return process.env.APP_VERSION ?? "0.0.0-dev";
}

async function sha256File(filePath: string): Promise<string> {
	const hash = createHash("sha256");
	const stream = fs.createReadStream(filePath);
	stream.on("data", (chunk) => hash.update(chunk));
	await finished(stream);
	return hash.digest("hex");
}

/** Erzeugt per SQLite-Backup-API einen konsistenten Snapshot der laufenden DB. */
async function createDatabaseSnapshot(): Promise<{ snapshotPath: string; cleanup: () => void }> {
	const snapshotPath = path.join(os.tmpdir(), `iv-db-snapshot-${crypto.randomUUID()}.db`);
	await getDb().backup(snapshotPath);
	return {
		snapshotPath,
		cleanup: () => {
			try {
				fs.rmSync(snapshotPath, { force: true });
			} catch {
				// Temp-Datei - Fehler beim Aufräumen ignorieren.
			}
		},
	};
}

interface FileEntry {
	/** Absoluter Pfad im Dateisystem. */
	absolutePath: string;
	/** Pfad innerhalb der ZIP (POSIX-Separatoren). */
	zipPath: string;
	size: number;
}

/** Sammelt alle Dateien unterhalb von files/ (inkl. Sidecar-Metadaten). */
function collectFilesEntries(): FileEntry[] {
	const root = getFilesDir();
	const entries: FileEntry[] = [];
	const walk = (dir: string): void => {
		for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
			const absolute = path.join(dir, dirent.name);
			if (dirent.isDirectory()) {
				walk(absolute);
			} else if (dirent.isFile()) {
				const relative = path.relative(root, absolute).split(path.sep).join("/");
				entries.push({ absolutePath: absolute, zipPath: `files/${relative}`, size: fs.statSync(absolute).size });
			}
		}
	};
	if (fs.existsSync(root)) walk(root);
	entries.sort((a, b) => a.zipPath.localeCompare(b.zipPath));
	return entries;
}

async function writeZipArchive(targetPath: string, manifest: BackupManifest, entries: { absolutePath: string; zipPath: string }[]): Promise<void> {
	fs.mkdirSync(path.dirname(targetPath), { recursive: true });
	const output = fs.createWriteStream(targetPath);
	const archive = archiver("zip", { zlib: { level: 6 } });
	const done = finished(output);
	archive.on("error", (error) => {
		output.destroy(error);
	});
	archive.pipe(output);
	// manifest.json zuerst eintragen, damit es beim Entpacken zuerst auftaucht.
	archive.append(JSON.stringify(manifest, null, 2), { name: MANIFEST_NAME });
	for (const entry of entries) {
		archive.file(entry.absolutePath, { name: entry.zipPath });
	}
	await archive.finalize();
	await done;
}

// ------------------------------------------------------------
// Export
// ------------------------------------------------------------

async function buildBackupEntries(): Promise<{
	manifest: BackupManifest;
	entries: FileEntry[];
	totalBytes: number;
	cleanup: () => void;
}> {
	const snapshot = await createDatabaseSnapshot();
	try {
		const dbEntry: FileEntry = {
			absolutePath: snapshot.snapshotPath,
			zipPath: DB_ZIP_PATH,
			size: fs.statSync(snapshot.snapshotPath).size,
		};
		const fileEntries = collectFilesEntries();
		const allEntries = [dbEntry, ...fileEntries];

		const manifestFiles: BackupManifest["files"] = [];
		for (const entry of allEntries) {
			manifestFiles.push({ path: entry.zipPath, sha256: await sha256File(entry.absolutePath), size: entry.size });
		}

		const manifest: BackupManifest = {
			app: APP_ID,
			appVersion: getAppVersion(),
			schemaVersion: LATEST_SCHEMA_VERSION,
			createdAt: new Date().toISOString(),
			files: manifestFiles,
		};
		const totalBytes = allEntries.reduce((sum, e) => sum + e.size, 0);
		return { manifest, entries: allEntries, totalBytes, cleanup: snapshot.cleanup };
	} catch (error) {
		snapshot.cleanup();
		throw error;
	}
}

/**
 * Exportiert die kompletten Anwendungsdaten (Datenbank + Dateien) als
 * Backup-ZIP in die angegebene Zieldatei (Streaming, Multi-GB-tauglich).
 */
export async function exportBackup(targetPath: string): Promise<BackupExportResult> {
	const { manifest, entries, totalBytes, cleanup } = await buildBackupEntries();
	try {
		await writeZipArchive(targetPath, manifest, entries);
		return { targetPath, fileCount: entries.length, totalBytes };
	} finally {
		cleanup();
	}
}

/**
 * Erzeugt das Backup-ZIP als lesbaren Stream (für den HTTP-Download im
 * reinen Browser-/Dev-Modus, wo kein Dateidialog zur Verfügung steht).
 * Achtung: Der Stream muss vom Aufrufer konsumiert werden; danach wird der
 * temporäre DB-Snapshot automatisch entfernt.
 */
export async function createBackupZipStream(): Promise<{ stream: NodeJS.ReadableStream; fileName: string }> {
	const { manifest, entries, cleanup } = await buildBackupEntries();
	const archive = archiver("zip", { zlib: { level: 6 } });
	archive.on("end", cleanup);
	archive.on("error", cleanup);
	archive.append(JSON.stringify(manifest, null, 2), { name: MANIFEST_NAME });
	for (const entry of entries) {
		archive.file(entry.absolutePath, { name: entry.zipPath });
	}
	void archive.finalize();
	const stamp = new Date().toISOString().slice(0, 10);
	return { stream: archive, fileName: `immobase-backup-${stamp}.zip` };
}

// ------------------------------------------------------------
// Import: Entpacken + Validieren
// ------------------------------------------------------------

interface ExtractedBackup {
	extractDir: string;
	manifest: BackupManifest;
}

/** Öffnet eine ZIP-Datei mit yauzl (Promise-Wrapper, lazyEntries). */
function openZip(zipPath: string): Promise<yauzl.ZipFile> {
	return new Promise((resolve, reject) => {
		yauzl.open(zipPath, { lazyEntries: true, autoClose: true }, (error, zipfile) => {
			if (error || !zipfile) reject(error ?? new Error("ZIP konnte nicht geöffnet werden."));
			else resolve(zipfile);
		});
	});
}

function openEntryStream(zipfile: yauzl.ZipFile, entry: yauzl.Entry): Promise<NodeJS.ReadableStream> {
	return new Promise((resolve, reject) => {
		zipfile.openReadStream(entry, (error, stream) => {
			if (error || !stream) reject(error ?? new Error("ZIP-Eintrag konnte nicht gelesen werden."));
			else resolve(stream);
		});
	});
}

function isSafeZipEntryPath(entryName: string): boolean {
	// Schutz gegen Zip-Slip: keine absoluten Pfade, keine ..-Segmente, keine
	// Backslashes (Windows-Traversal), keine Laufwerksbuchstaben.
	if (!entryName || entryName.startsWith("/") || entryName.includes("\\") || entryName.includes("..")) return false;
	if (/^[a-zA-Z]:/.test(entryName)) return false;
	return true;
}

/**
 * Entpackt ein Backup-ZIP streaming in ein temp-Verzeichnis innerhalb des
 * Datenverzeichnisses (gleiches Dateisystem für die späteren atomaren
 * Umbenennungen) und validiert Manifest + SHA-256-Prüfsummen aller Dateien.
 */
async function extractAndValidate(zipPath: string): Promise<ExtractedBackup> {
	const extractDir = path.join(getDataDir(), `.import-extract-${crypto.randomUUID()}`);
	fs.mkdirSync(extractDir, { recursive: true });

	try {
		const zipfile = await openZip(zipPath);
		const entryPaths: string[] = [];
		let manifestRaw: string | null = null;

		await new Promise<void>((resolve, reject) => {
			zipfile.on("error", reject);
			zipfile.on("end", () => resolve());
			zipfile.on("entry", (entry: yauzl.Entry) => {
				void (async () => {
					try {
						const entryName = entry.fileName;
						if (/\/$/.test(entryName)) {
							// Verzeichnis-Eintrag.
							if (!isSafeZipEntryPath(entryName)) throw new Error(`Unsicherer ZIP-Eintrag: ${entryName}`);
							zipfile.readEntry();
							return;
						}
						if (!isSafeZipEntryPath(entryName)) {
							throw new Error(`Unsicherer ZIP-Eintrag (Zip-Slip-Schutz): ${entryName}`);
						}
						const stream = await openEntryStream(zipfile, entry);
						if (entryName === MANIFEST_NAME) {
							const chunks: Buffer[] = [];
							stream.on("data", (chunk: Buffer) => chunks.push(chunk));
							await finished(stream);
							manifestRaw = Buffer.concat(chunks).toString("utf8");
						} else {
							const target = path.join(extractDir, entryName);
							fs.mkdirSync(path.dirname(target), { recursive: true });
							const out = fs.createWriteStream(target);
							stream.pipe(out);
							await finished(out);
							entryPaths.push(entryName);
						}
						zipfile.readEntry();
					} catch (error) {
						reject(error);
					}
				})();
			});
			zipfile.readEntry();
		});

		if (!manifestRaw) {
			throw new Error("Keine manifest.json im Backup gefunden - keine gültige Sicherungsdatei.");
		}

		const manifest = JSON.parse(manifestRaw) as BackupManifest;
		if (manifest.app !== APP_ID) {
			throw new Error(`Ungültige Sicherungsdatei (App "${manifest.app ?? "?"}", erwartet "${APP_ID}").`);
		}
		if (typeof manifest.schemaVersion !== "number" || !Array.isArray(manifest.files)) {
			throw new Error("Das Manifest der Sicherungsdatei ist beschädigt oder unvollständig.");
		}
		if (manifest.schemaVersion > LATEST_SCHEMA_VERSION) {
			throw new Error(
				`Das Backup wurde mit einer NEUEREN Version der Anwendung erstellt ` +
					`(Schema-Version ${manifest.schemaVersion}, diese App unterstützt bis ${LATEST_SCHEMA_VERSION}). ` +
					`Bitte aktualisieren Sie die Anwendung.`
			);
		}

		// Vollständigkeit + Prüfsummen aller Dateien verifizieren.
		const manifestPaths = new Set(manifest.files.map((f) => f.path));
		for (const extracted of entryPaths) {
			if (!manifestPaths.has(extracted)) {
				throw new Error(`Datei "${extracted}" ist im Manifest nicht aufgeführt - Sicherungsdatei inkonsistent.`);
			}
		}
		for (const file of manifest.files) {
			const absolute = path.join(extractDir, file.path);
			if (!fs.existsSync(absolute)) {
				throw new Error(`Im Manifest aufgeführte Datei "${file.path}" fehlt im Archiv.`);
			}
			const actualHash = await sha256File(absolute);
			if (actualHash !== file.sha256) {
				throw new Error(`Prüfsummenfehler bei "${file.path}" - die Sicherungsdatei ist beschädigt.`);
			}
		}

		return { extractDir, manifest };
	} catch (error) {
		fs.rmSync(extractDir, { recursive: true, force: true });
		throw error;
	}
}

// ------------------------------------------------------------
// Import: Modus "Ersetzen" (atomarer Austausch)
// ------------------------------------------------------------

/**
 * Legt ein vollständiges Sicherungs-Backup des IST-Zustands an (vor dem
 * Import). Gibt den Pfad zurück, oder null, wenn noch keine DB existiert.
 */
async function createPreImportBackup(): Promise<string | null> {
	if (!fs.existsSync(getDatabaseFilePath())) return null;
	const backupDir = path.join(getDataDir(), "backups");
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	const backupPath = path.join(backupDir, `pre-import-${stamp}.zip`);
	await exportBackup(backupPath);
	return backupPath;
}

async function importReplace(extractDir: string): Promise<void> {
	const dataDir = getDataDir();
	const dbPath = getDatabaseFilePath();
	const filesDir = getFilesDir();
	const trashDir = path.join(dataDir, `.import-trash-${crypto.randomUUID()}`);
	fs.mkdirSync(trashDir, { recursive: true });

	const newDbPath = path.join(extractDir, DB_ZIP_PATH);
	if (!fs.existsSync(newDbPath)) {
		throw new Error("Die Sicherungsdatei enthält keine data.db.");
	}
	const newFilesDir = path.join(extractDir, "files");

	closeDb();

	const moved: { from: string; to: string }[] = [];
	try {
		// 1. Ist-Zustand beiseite räumen (atomare Umbenennungen im selben FS).
		if (fs.existsSync(dbPath)) {
			const target = path.join(trashDir, "data.db");
			fs.renameSync(dbPath, target);
			moved.push({ from: dbPath, to: target });
		}
		for (const suffix of ["-wal", "-shm"]) {
			if (fs.existsSync(dbPath + suffix)) fs.rmSync(dbPath + suffix, { force: true });
		}
		if (fs.existsSync(filesDir)) {
			const target = path.join(trashDir, "files");
			fs.renameSync(filesDir, target);
			moved.push({ from: filesDir, to: target });
		}

		// 2. Neue Daten an ihre Stelle bewegen.
		fs.renameSync(newDbPath, dbPath);
		if (fs.existsSync(newFilesDir)) {
			fs.renameSync(newFilesDir, filesDir);
		} else {
			fs.mkdirSync(filesDir, { recursive: true });
		}

		// 3. Neu öffnen + ggf. migrieren (ältere Backups) - schlägt das fehl,
		//    wird komplett zurückgerollt.
		getDb();

		// 4. Erfolg: alten Zustand endgültig verwerfen.
		fs.rmSync(trashDir, { recursive: true, force: true });
	} catch (error) {
		// Rollback: ursprüngliche Dateien zurückbewegen.
		closeDb();
		for (const { from, to } of [...moved].reverse()) {
			try {
				if (fs.existsSync(from)) fs.rmSync(from, { recursive: true, force: true });
				if (fs.existsSync(to)) fs.renameSync(to, from);
			} catch (rollbackError) {
				console.error("Rollback nach fehlgeschlagenem Import fehlgeschlagen", rollbackError);
			}
		}
		for (const suffix of ["-wal", "-shm"]) {
			if (fs.existsSync(dbPath + suffix)) fs.rmSync(dbPath + suffix, { force: true });
		}
		// Verbindung wieder herstellen, damit die App weiterläuft.
		getDb();
		throw error;
	} finally {
		fs.rmSync(trashDir, { recursive: true, force: true });
	}
}

// ------------------------------------------------------------
// Import: Modus "Zusammenführen"
// ------------------------------------------------------------

/**
 * Migriert die entpackte Quell-DB bei Bedarf auf das aktuelle Schema,
 * damit die Spalten beim Zusammenführen übereinstimmen.
 */
function migrateSourceDatabaseIfNeeded(sourceDbPath: string, schemaVersion: number): void {
	if (schemaVersion >= LATEST_SCHEMA_VERSION) return;
	const sourceDb = new BetterSqlite3(sourceDbPath);
	try {
		// Bewusst NICHT im WAL-Modus betreiben: Die Quell-DB wird nur zum
		// einmaligen Auslesen geATTACHt - ein WAL-Rahmenwerk mit
		// -wal/-shm-Seitendateien würde das Entpacken/Verwerfen erschweren.
		sourceDb.pragma("journal_mode = DELETE");
		sourceDb.pragma("foreign_keys = OFF"); // reine Migrations-Verbindung
		migrateDatabase(sourceDb, sourceDbPath);
	} finally {
		sourceDb.close();
	}
}

async function importMerge(extractDir: string, manifest: BackupManifest): Promise<Record<string, number>> {
	const sourceDbPath = path.join(extractDir, DB_ZIP_PATH);
	if (!fs.existsSync(sourceDbPath)) {
		throw new Error("Die Sicherungsdatei enthält keine data.db.");
	}
	migrateSourceDatabaseIfNeeded(sourceDbPath, manifest.schemaVersion);

	const db = getDb();
	db.pragma("wal_checkpoint(TRUNCATE)");

	const mergedRows: Record<string, number> = {};

	// Tabellenliste und Spalten-Schnittmengen VOR der Transaktion ermitteln
	// (keine offenen Statements auf der geATTACHten Quelle während des
	// DETACH nach dem Commit).
	db.prepare("ATTACH DATABASE ? AS src").run(sourceDbPath);
	try {
		const sourceTables = db
			.prepare("SELECT name FROM src.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
			.all() as { name: string }[];
		const tablePlans: { name: string; colList: string }[] = [];
		for (const { name } of sourceTables) {
			// Spalten-Schnittmenge bilden (robust gegenüber Schema-Drift
			// zwischen älterem Backup und aktueller App).
			const mainCols = (db.prepare(`SELECT name FROM pragma_table_info(?)`).all(name) as { name: string }[]).map((c) => c.name);
			const srcCols = (db.prepare(`SELECT name FROM src.pragma_table_info(?)`).all(name) as { name: string }[]).map(
				(c) => c.name
			);
			const common = mainCols.filter((c) => srcCols.includes(c));
			if (common.length === 0) continue;
			tablePlans.push({ name, colList: common.map((c) => `"${c}"`).join(", ") });
		}

		const mergeAll = db.transaction(() => {
			for (const { name, colList } of tablePlans) {
				const result = db
					.prepare(`INSERT OR IGNORE INTO main."${name}" (${colList}) SELECT ${colList} FROM src."${name}"`)
					.run();
				mergedRows[name] = result.changes;
			}
		});
		mergeAll();
	} finally {
		db.prepare("DETACH DATABASE src").run();
	}

	// Dateien zusammenführen: nur kopieren, was lokal noch nicht existiert.
	const sourceFilesDir = path.join(extractDir, "files");
	let copiedFiles = 0;
	if (fs.existsSync(sourceFilesDir)) {
		const targetRoot = getFilesDir();
		const walk = (dir: string): void => {
			for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
				const absolute = path.join(dir, dirent.name);
				if (dirent.isDirectory()) {
					walk(absolute);
				} else if (dirent.isFile()) {
					const relative = path.relative(sourceFilesDir, absolute);
					const target = path.join(targetRoot, relative);
					if (!fs.existsSync(target)) {
						fs.mkdirSync(path.dirname(target), { recursive: true });
						fs.copyFileSync(absolute, target);
						copiedFiles++;
					}
				}
			}
		};
		walk(sourceFilesDir);
	}
	mergedRows["__files__"] = copiedFiles;

	return mergedRows;
}

// ------------------------------------------------------------
// Import: öffentliche API
// ------------------------------------------------------------

/**
 * Importiert eine Backup-ZIP. Modi:
 * - "replace": ersetzt den kompletten Ist-Zustand (atomar, mit Rollback).
 * - "merge":   fügt fehlende Zeilen/Dateien hinzu (Konfliktstrategie:
 *   lokaler Bestand gewinnt, siehe Dateikopf).
 *
 * Vorher wird automatisch ein Backup des Ist-Zustands unter
 * `<dataDir>/backups/` angelegt.
 */
export async function importBackup(zipPath: string, mode: "replace" | "merge"): Promise<BackupImportResult> {
	if (!fs.existsSync(zipPath)) {
		throw new Error(`Die Datei wurde nicht gefunden: ${zipPath}`);
	}

	const { extractDir, manifest } = await extractAndValidate(zipPath);

	const backupPath = await createPreImportBackup();

	try {
		if (mode === "replace") {
			await importReplace(extractDir);
			return { mode, importedFiles: manifest.files.length, backupPath };
		}
		const mergedRows = await importMerge(extractDir, manifest);
		return { mode, importedFiles: mergedRows["__files__"] ?? 0, mergedRows, backupPath };
	} finally {
		fs.rmSync(extractDir, { recursive: true, force: true });
	}
}
