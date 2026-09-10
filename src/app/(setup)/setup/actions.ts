"use server";

import { redirect } from "next/navigation";

import { saveCompanySettings } from "@/data/company-settings";
import { countUsers, getUserByEmail } from "@/data/users";
import { ActionState } from "@/lib/action-state";
import { provisionUserAccount } from "@/lib/auth/bootstrap";
import { createSession } from "@/lib/auth/session";
import { isValidEmail, MIN_PASSWORD_LENGTH, normalizeEmail, validatePassword } from "@/lib/auth/validation";
import { getDataKeyBase64 } from "@/lib/data-key";
import { getT } from "@/lib/i18n/server";

/**
 * Guard für alle Setup-Actions (Defense-in-Depth): Die Ersteinrichtung ist
 * nur zulässig, solange noch kein Benutzerkonto existiert – danach sind die
 * Einstellungen ausschließlich über /einstellungen (requireAdmin) änderbar.
 * Das Schutzniveau entspricht dem Registrierungs-Bootstrapping: Wer lokalen
 * Zugriff auf eine frische Installation hat, könnte sich ohnehin als erster
 * Nutzer zum Administrator machen.
 */
function ensureSetupAllowed(): void {
	if (countUsers() > 0) {
		redirect("/login");
	}
}

function getString(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === "string" ? value.trim() : "";
}

/** Setup-Schritt „Absenderdaten“ (Briefkopf für erzeugte PDFs). Überspringbar – leere Angaben sind zulässig. */
export async function setupCompanySettingsAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	ensureSetupAllowed();
	const t = await getT();

	try {
		saveCompanySettings({
			name: getString(formData, "name"),
			street: getString(formData, "street"),
			zipCode: getString(formData, "zipCode"),
			city: getString(formData, "city"),
			additional: getString(formData, "additional") || null,
		});
	} catch (error) {
		console.error("setupCompanySettingsAction failed", error);
		return { error: t("setup.errors.saveCompany") };
	}

	return { success: true };
}

/**
 * Setup-Schritt „Wiederherstellungsschlüssel“: liefert den Master-Schlüssel
 * der lokalen Datenverschlüsselung als Base64-Text, damit der Nutzer ihn
 * während der Ersteinrichtung sicher verwahren kann. Entspricht
 * getRecoveryKeyAction() in /einstellungen, aber mit Setup-Guard statt
 * Admin-Guard (es existiert ja noch kein Konto). Der Schlüssel wird beim
 * Abruf bei Bedarf neu erzeugt (siehe src/lib/data-key.ts) – es gibt zu
 * diesem Zeitpunkt noch keine Daten, die er gefährden könnte.
 */
export async function getSetupRecoveryKeyAction(): Promise<{ key?: string; error?: string }> {
	ensureSetupAllowed();
	const t = await getT();
	try {
		return { key: getDataKeyBase64() };
	} catch (error) {
		console.error("getSetupRecoveryKeyAction failed", error);
		return { error: t("setup.errors.recoveryKeyRead") };
	}
}

/**
 * Letzter (einziger nicht überspringbarer) Setup-Schritt: legt das
 * Administratorkonto an. Danach existiert ein Benutzer – die Ersteinrichtung
 * ist abgeschlossen und /setup sperrt sich selbst (siehe page.tsx).
 *
 * Ohne SMTP-Konfiguration (Offline-Normalfall) ist die E-Mail-Adresse sofort
 * bestätigt und der Nutzer wird direkt angemeldet (kein erneuter Login).
 * Mit SMTP läuft der klassische Verifizierungslink-Flow: Redirect zur
 * Login-Seite mit entsprechendem Hinweis.
 */
export async function setupAccountAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	ensureSetupAllowed();
	const t = await getT();

	const email = normalizeEmail(String(formData.get("email") ?? ""));
	const password = String(formData.get("password") ?? "");
	const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

	if (!isValidEmail(email)) {
		return { error: t("auth.errors.invalidEmail") };
	}

	const passwordError = validatePassword(password);
	if (passwordError) {
		return { error: t(passwordError, { min: MIN_PASSWORD_LENGTH }) };
	}

	if (password !== passwordConfirm) {
		return { error: t("auth.errors.passwordMismatch") };
	}

	// Duplikat-Prüfung ist hier defensiv: ensureSetupAllowed() garantiert
	// bereits, dass noch kein Konto existiert.
	const { emailSent } = await provisionUserAccount(email, password, true);

	if (emailSent) {
		redirect(`/login?registered=1&firstAdmin=1&emailSent=1&email=${encodeURIComponent(email)}`);
	}

	const user = getUserByEmail(email);
	if (!user) {
		return { error: t("setup.errors.accountCreate") };
	}
	await createSession(user.id);
	redirect("/");
}
