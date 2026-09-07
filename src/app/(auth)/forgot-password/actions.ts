"use server";

import { getUserByEmail } from "@/data/users";
import { ActionState } from "@/lib/action-state";
import { createPasswordResetToken } from "@/lib/auth/tokens";
import { sendPasswordResetEmail } from "@/lib/email/mailer";
import { isValidEmail, normalizeEmail } from "@/lib/auth/validation";

const GENERIC_MESSAGE = "Falls ein Konto mit dieser E-Mail-Adresse existiert, haben wir einen Link zum Zurücksetzen des Passworts versendet.";

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

	return { success: true, message: GENERIC_MESSAGE };
}
