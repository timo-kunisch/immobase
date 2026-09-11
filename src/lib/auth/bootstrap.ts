import "server-only";

import { createUser, markEmailVerified } from "@/data/users";
import { hashPassword } from "@/lib/auth/password";
import { createVerificationToken } from "@/lib/auth/tokens";
import { isSmtpConfigured, sendVerificationEmail } from "@/lib/email/mailer";

export interface ProvisionResult {
	/** true, wenn eine Verifizierungs-E-Mail versendet wurde (nur bei konfiguriertem SMTP). */
	emailSent: boolean;
}

export interface ProvisionNameInput {
	/** Vorname (null = nicht hinterlegt). */
	firstName: string | null;
	/** Nachname (null = nicht hinterlegt). */
	lastName: string | null;
}

/**
 * Gemeinsames Anlegen eines Benutzerkontos für Registrierung und
 * Ersteinrichtung (Setup-Wizard) – Bootstrapping-Muster:
 *
 * - Der ERSTE Nutzer im System (isFirstUser) wird automatisch ADMIN und ist
 *   sofort freigeschaltet (isApproved = true).
 * - Alle weiteren Registrierungen sind USER und benötigen zusätzlich die
 *   Freigabe durch einen Administrator unter /admin/users.
 * - Wenn SMTP konfiguriert ist, wird eine Verifizierungs-E-Mail versendet;
 *   ein Login ist dann erst nach Bestätigung der E-Mail möglich.
 * - OHNE SMTP-Konfiguration (Normalfall der offline laufenden Desktop-App)
 *   sind alle E-Mail-Funktionen deaktiviert – eine Verifizierungs-Mail kann
 *   niemanden erreichen. Die E-Mail-Adresse wird daher sofort als bestätigt
 *   markiert, damit der Login nicht an einem nicht zustellbaren Schritt
 *   hängt (Self-Healing für Altfälle zusätzlich im Login selbst).
 *
 * Aufrufer validieren vorher selbst (E-Mail-Format, Passwort-Regeln,
 * Namens-Pflichtfelder, Duplikat-Prüfung) – diese Funktion legt das Konto
 * ungeprüft an.
 */
export async function provisionUserAccount(
	email: string,
	password: string,
	isFirstUser: boolean,
	name: ProvisionNameInput = { firstName: null, lastName: null },
): Promise<ProvisionResult> {
	const passwordHash = await hashPassword(password);

	createUser({
		email,
		passwordHash,
		role: isFirstUser ? "ADMIN" : "USER",
		isApproved: isFirstUser,
		firstName: name.firstName,
		lastName: name.lastName,
	});

	const emailSent = isSmtpConfigured();
	if (emailSent) {
		const token = await createVerificationToken(email);
		await sendVerificationEmail(email, token);
	} else {
		markEmailVerified(email);
	}

	return { emailSent };
}
