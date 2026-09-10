"use server";

import { getUserByEmail } from "@/data/users";
import { ActionState } from "@/lib/action-state";
import { createPasswordResetToken } from "@/lib/auth/tokens";
import { isSmtpConfigured, sendPasswordResetEmail } from "@/lib/email/mailer";
import { getT } from "@/lib/i18n/server";
import { isValidEmail, normalizeEmail } from "@/lib/auth/validation";


/**
 * Absichtlich IMMER dieselbe Erfolgsmeldung, unabhängig davon, ob ein
 * Konto mit dieser E-Mail-Adresse existiert – verhindert, dass sich über
 * dieses Formular erraten lässt, welche E-Mail-Adressen registriert sind.
 *
 * Ohne SMTP-Konfiguration ist der Passwort-Reset deaktiviert (die
 * Reset-E-Mail könnte niemanden erreichen) - es wird dann weder ein Token
 * erzeugt noch eine E-Mail versendet.
 */
export async function forgotPasswordAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const t = await getT();
	if (!isSmtpConfigured()) {
		return {
			error: t("auth.errors.resetUnavailable"),
		};
	}

	const email = normalizeEmail(String(formData.get("email") ?? ""));

	if (!isValidEmail(email)) {
		return { error: t("auth.errors.invalidEmail") };
	}

	const user = getUserByEmail(email);
	if (user) {
		const token = await createPasswordResetToken(email);
		await sendPasswordResetEmail(email, token);
	}

	return { success: true, message: t("auth.messages.forgotGeneric") };
}
