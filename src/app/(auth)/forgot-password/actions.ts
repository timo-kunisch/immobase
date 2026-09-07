"use server";

import { getUserByEmail } from "@/data/users";
import { ActionState } from "@/lib/action-state";
import { createPasswordResetToken } from "@/lib/auth/tokens";
import { isSmtpConfigured, sendPasswordResetEmail } from "@/lib/email/mailer";
import { isValidEmail, normalizeEmail } from "@/lib/auth/validation";

const GENERIC_MESSAGE = "Falls ein Konto mit dieser E-Mail-Adresse existiert, haben wir einen Link zum Zurücksetzen des Passworts versendet.";

// Ohne SMTP kann die Reset-Mail nicht zugestellt werden - sie landet nur in
// der Outbox-Logdatei auf dem Server-Rechner. Der Hinweis macht diesen
// Offline-Fallback auffindbar, statt den Nutzer vergeblich auf eine Mail
// warten zu lassen.
const OFFLINE_MESSAGE =
	"Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde ein Link zum Zurücksetzen des Passworts erzeugt. " +
	"Hinweis: Es ist kein E-Mail-Versand (SMTP) konfiguriert - die Nachricht wurde nicht verschickt, sondern in der Datei " +
	"logs/outbox.log im App-Datenverzeichnis protokolliert. Den Link können Sie von dort übernehmen.";

/**
 * Absichtlich IMMER dieselbe Erfolgsmeldung, unabhängig davon, ob ein
 * Konto mit dieser E-Mail-Adresse existiert – verhindert, dass sich über
 * dieses Formular erraten lässt, welche E-Mail-Adressen registriert sind.
 */
export async function forgotPasswordAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const email = normalizeEmail(String(formData.get("email") ?? ""));

	if (!isValidEmail(email)) {
		return { error: "Bitte geben Sie eine gültige E-Mail-Adresse an." };
	}

	const user = getUserByEmail(email);
	if (user) {
		const token = await createPasswordResetToken(email);
		await sendPasswordResetEmail(email, token);
	}

	return { success: true, message: isSmtpConfigured() ? GENERIC_MESSAGE : OFFLINE_MESSAGE };
}
