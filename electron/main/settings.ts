import fs from "node:fs";
import path from "node:path";

/**
 * Persistente App-Einstellungen der Electron-Shell in
 * `<userData>/settings.json` (NICHT in der SQLite-DB - diese Datei steuert,
 * WIE die App startet, bevor die Datenbank überhaupt existiert:
 * Modus local/host/client, letzter Port, Host-Token, Client-Verbindung).
 */

export type AppMode = "local" | "host" | "client";

export interface AppSettings {
	/**
	 * null = Erststart -> die Modus-Auswahl erfolgt im Setup-Wizard (/setup);
	 * bis dahin läuft der eingebettete Server im lokalen Modus.
	 */
	mode: AppMode | null;
	/** Zuletzt verwendeter Port (Stabilität für E-Mail-Links/LAN-URL). */
	lastPort: number | null;
	/** Zugangs-Token für Clients (nur Modus host). */
	hostToken: string | null;
	/** Zuletzt verwendeter LAN-Port des Host-Proxys (nur Modus host). */
	lastHostPort: number | null;
	/** Basis-URL des Hosts (nur Modus client). */
	clientHostUrl: string | null;
	/** Zugangs-Token des Hosts (nur Modus client). */
	clientToken: string | null;
	/**
	 * Master-Schlüssel für die Datenverschlüsselung at rest, mit dem
	 * OS-Schlüsselbund verschlüsselt ("safe:<base64>", Electron safeStorage)
	 * bzw. als Fallback ohne verfügbaren Schlüsselbund nur base64-kodiert
	 * ("plain:<base64>", siehe electron/main/data-key.ts).
	 */
	encryptedDataKey: string | null;
}

const DEFAULT_SETTINGS: AppSettings = {
	mode: null,
	lastPort: null,
	hostToken: null,
	lastHostPort: null,
	clientHostUrl: null,
	clientToken: null,
	encryptedDataKey: null,
};

export class SettingsStore {
	private readonly filePath: string;
	private settings: AppSettings;

	constructor(userDataDir: string) {
		this.filePath = path.join(userDataDir, "settings.json");
		this.settings = this.load();
	}

	private load(): AppSettings {
		try {
			const raw = fs.readFileSync(this.filePath, "utf8");
			const parsed = JSON.parse(raw) as Partial<AppSettings>;
			return { ...DEFAULT_SETTINGS, ...parsed };
		} catch {
			return { ...DEFAULT_SETTINGS };
		}
	}

	private save(): void {
		fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
		fs.writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), "utf8");
		try {
			// Enthält Zugangs-Tokens + verschlüsselten Datenschlüssel - Datei
			// restriktiv halten (nur eigener OS-Benutzer).
			fs.chmodSync(this.filePath, 0o600);
		} catch {
			// Best effort (Windows kennt keine POSIX-Rechte).
		}
	}

	get(): AppSettings {
		return { ...this.settings };
	}

	update(patch: Partial<AppSettings>): AppSettings {
		this.settings = { ...this.settings, ...patch };
		this.save();
		return this.get();
	}
}

/** Erzeugt ein neues Host-Token (URL-sicher, nicht erratbar). */
export function generateHostToken(): string {
	return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}
