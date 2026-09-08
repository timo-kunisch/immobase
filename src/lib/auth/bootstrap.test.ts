import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { closeDb } from "@/data/db";
import { countUsers, getUserByEmail } from "@/data/users";
import { provisionUserAccount } from "@/lib/auth/bootstrap";

/**
 * Tests für das gemeinsame Konto-Anlegen (Registrierung + Setup-Wizard):
 * Rollen-/Freigabe-Bootstrapping und die Kopplung der E-Mail-Verifizierung
 * an die SMTP-Konfiguration. Der Mailer wird gemockt, damit der Test keinen
 * echten Versand versucht und beide Zweige (mit/ohne SMTP) deterministisch
 * prüfen kann.
 */

const mocks = vi.hoisted(() => ({
	smtpConfigured: false,
	sentMails: [] as string[],
}));

vi.mock("@/lib/email/mailer", () => ({
	isSmtpConfigured: () => mocks.smtpConfigured,
	sendVerificationEmail: async (email: string) => {
		mocks.sentMails.push(email);
	},
}));

let testDir: string;

beforeEach(() => {
	testDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-bootstrap-test-"));
	process.env.APP_DATA_DIR = testDir;
	mocks.smtpConfigured = false;
	mocks.sentMails = [];
});

afterEach(() => {
	closeDb();
	fs.rmSync(testDir, { recursive: true, force: true });
});

describe("provisionUserAccount", () => {
	it("legt den ersten Nutzer als freigeschalteten Administrator an und bestätigt die E-Mail ohne SMTP sofort", async () => {
		const result = await provisionUserAccount("admin@example.com", "geheim123", true);

		expect(result.emailSent).toBe(false);
		expect(mocks.sentMails).toHaveLength(0);

		const user = getUserByEmail("admin@example.com");
		expect(user?.role).toBe("ADMIN");
		expect(user?.isApproved).toBe(true);
		expect(user?.emailVerified).not.toBeNull();
		expect(user?.passwordHash).not.toBe("geheim123");
	});

	it("versendet mit konfiguriertem SMTP eine Verifizierungs-Mail und lässt die Adresse unbestätigt", async () => {
		mocks.smtpConfigured = true;

		const result = await provisionUserAccount("admin@example.com", "geheim123", true);

		expect(result.emailSent).toBe(true);
		expect(mocks.sentMails).toEqual(["admin@example.com"]);

		const user = getUserByEmail("admin@example.com");
		expect(user?.role).toBe("ADMIN");
		expect(user?.isApproved).toBe(true);
		expect(user?.emailVerified).toBeNull();
	});

	it("legt weitere Nutzer als nicht freigeschaltete USER an", async () => {
		await provisionUserAccount("admin@example.com", "geheim123", true);
		await provisionUserAccount("user@example.com", "geheim123", false);

		expect(countUsers()).toBe(2);

		const user = getUserByEmail("user@example.com");
		expect(user?.role).toBe("USER");
		expect(user?.isApproved).toBe(false);
		// Ohne SMTP wird die Adresse auch für Folgenutzer sofort bestätigt
		// (die Mail könnte ohnehin niemanden erreichen, siehe bootstrap.ts).
		expect(user?.emailVerified).not.toBeNull();
	});
});
