import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	ensureSecretsEncrypted,
	getSecretSettingsStatus,
	getSetting,
	isSecretSettingKey,
	listSettings,
	setSetting,
} from "@/data/app-settings";
import { closeDb, getDb } from "@/data/db";

/**
 * Tests für die feldverschlüsselte Ablage von Geheimnissen (SMTP-Passwort,
 * LetterXpress-API-Key) in app_settings - siehe src/data/app-settings.ts.
 */

let testDir: string;

beforeEach(() => {
	testDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-appsettings-test-"));
	process.env.APP_DATA_DIR = testDir;
});

afterEach(() => {
	closeDb();
	fs.rmSync(testDir, { recursive: true, force: true });
});

function rawSettingValue(key: string): string | undefined {
	const row = getDb().prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as { value: string } | undefined;
	return row?.value;
}

describe("Secret-Verschlüsselung in app_settings", () => {
	it("kennt die geschützten Schlüssel", () => {
		expect(isSecretSettingKey("smtp.pass")).toBe(true);
		expect(isSecretSettingKey("letterxpress.apikey")).toBe(true);
		expect(isSecretSettingKey("smtp.host")).toBe(false);
	});

	it("speichert Geheimnisse verschlüsselt und liest sie transparent", () => {
		setSetting("smtp.pass", "super-geheimes-passwort");

		const raw = rawSettingValue("smtp.pass");
		expect(raw).toMatch(/^enc:v1:/);
		expect(raw).not.toContain("super-geheimes-passwort");
		expect(getSetting("smtp.pass")).toBe("super-geheimes-passwort");
	});

	it("speichert Nicht-Geheimnisse weiterhin im Klartext", () => {
		setSetting("smtp.host", "smtp.example.com");
		expect(rawSettingValue("smtp.host")).toBe("smtp.example.com");
	});

	it("behandelt leere Secret-Werte als 'nicht konfiguriert' (kein Container)", () => {
		setSetting("smtp.pass", "");
		expect(rawSettingValue("smtp.pass")).toBe("");
		expect(getSetting("smtp.pass")).toBe("");
	});

	it("liest Klartext-Bestandswerte weiter (Abwärtskompatibilität) und migriert sie per ensureSecretsEncrypted", () => {
		// Bestand von einer Installation vor der Feldverschlüsselung simulieren.
		getDb()
			.prepare("INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)")
			.run("smtp.pass", "alt-klartext", new Date().toISOString());

		expect(getSetting("smtp.pass")).toBe("alt-klartext");
		expect(getSecretSettingsStatus()).toEqual({ secretsSet: 1, secretsEncrypted: 0 });

		expect(ensureSecretsEncrypted()).toBe(1);
		expect(rawSettingValue("smtp.pass")).toMatch(/^enc:v1:/);
		expect(getSetting("smtp.pass")).toBe("alt-klartext");
		expect(getSecretSettingsStatus()).toEqual({ secretsSet: 1, secretsEncrypted: 1 });

		// Idempotent.
		expect(ensureSecretsEncrypted()).toBe(0);
	});

	it("liefert undefined statt eines Fehlers, wenn der Schlüssel nicht passt (fail-closed)", () => {
		setSetting("letterxpress.apikey", "lx-geheim-key");
		const storedRaw = rawSettingValue("letterxpress.apikey")!;

		// Fremdes Gerät simulieren: neues Verzeichnis = anderer Master-Schlüssel,
		// aber dieselbe DB-Zeile (manuell kopierte data.db).
		const otherDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-appsettings-other-"));
		process.env.APP_DATA_DIR = otherDir;
		closeDb();
		getDb()
			.prepare("INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)")
			.run("letterxpress.apikey", storedRaw, new Date().toISOString());

		expect(getSetting("letterxpress.apikey")).toBeUndefined();

		closeDb();
		fs.rmSync(otherDir, { recursive: true, force: true });
	});

	it("maskiert Geheimnisse in listSettings", () => {
		setSetting("smtp.pass", "geheim");
		setSetting("smtp.host", "smtp.example.com");
		const listed = Object.fromEntries(listSettings().map((s) => [s.key, s.value]));
		expect(listed["smtp.pass"]).toBe("********");
		expect(listed["smtp.host"]).toBe("smtp.example.com");
	});
});
