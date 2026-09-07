import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { deleteSetting, setSetting } from "@/data/app-settings";
import { isSmtpConfigured } from "@/lib/email/mailer";

/**
 * Tests für die SMTP-Erkennung des Mailers (src/lib/email/mailer.ts).
 * Sie steuert, ob der Auth-Flow eine echte E-Mail-Verifizierung verlangt
 * (SMTP konfiguriert) oder die Adresse automatisch bestätigt (Offline-
 * Normalfall der Desktop-App - sonst wäre der Login an einem nicht
 * zustellbaren Schritt blockiert).
 *
 * Die App-Einstellungen liegen in der Test-DB (APP_DATA_DIR zeigt dank
 * src/test/setup.ts auf ein Temp-Verzeichnis).
 */

const SMTP_ENV_VARS = ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS"] as const;
const ORIGINAL_ENV = { ...process.env };

function clearSmtpEnv() {
	for (const key of SMTP_ENV_VARS) {
		delete process.env[key];
	}
}

beforeEach(() => {
	clearSmtpEnv();
	deleteSetting("smtp.host");
});

afterEach(() => {
	process.env = { ...ORIGINAL_ENV };
	deleteSetting("smtp.host");
});

describe("isSmtpConfigured", () => {
	it("liefert false, wenn weder App-Einstellung noch Umgebungsvariable gesetzt ist", () => {
		expect(isSmtpConfigured()).toBe(false);
	});

	it("liefert true, wenn SMTP_HOST als Umgebungsvariable gesetzt ist", () => {
		process.env.SMTP_HOST = "smtp.example.com";
		expect(isSmtpConfigured()).toBe(true);
	});

	it("liefert true, wenn smtp.host in den App-Einstellungen gesetzt ist", () => {
		setSetting("smtp.host", "smtp.example.com");
		expect(isSmtpConfigured()).toBe(true);
	});

	it("liefert wieder false, wenn die App-Einstellung entfernt wurde", () => {
		setSetting("smtp.host", "smtp.example.com");
		deleteSetting("smtp.host");
		expect(isSmtpConfigured()).toBe(false);
	});
});
