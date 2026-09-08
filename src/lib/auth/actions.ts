"use server";

import { redirect } from "next/navigation";

import { getUserByEmail, markEmailVerified } from "@/data/users";
import { getCurrentUser } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { destroySession } from "@/lib/auth/session";
import { createVerificationToken } from "@/lib/auth/tokens";
import { isSmtpConfigured, sendVerificationEmail } from "@/lib/email/mailer";
import { normalizeEmail } from "@/lib/auth/validation";
import { ActionState } from "@/lib/action-state";

/** Meldet den aktuellen Nutzer ab (löscht Session in DB + Cookie). */
export async function logoutAction(): Promise<void> {
	const user = await getCurrentUser();
	await destroySession();
	if (user) {
		logActivity(user, "LOGOUT", "auth", "Abgemeldet", user.id);
	}
	redirect("/login");
}

/**
 * Verschickt die Verifizierungs-E-Mail erneut (z. B. wenn der Nutzer die
 * ursprüngliche Mail nicht erhalten hat oder der Link abgelaufen ist).
 * Gibt aus Sicherheitsgründen (kein Enumerieren existierender Accounts)
 * immer dieselbe Erfolgsmeldung zurück, unabhängig davon, ob die
 * E-Mail-Adresse tatsächlich registriert ist.
 */
export async function resendVerificationAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const email = normalizeEmail(String(formData.get("email") ?? ""));
	if (!email) {
		return { error: "Bitte geben Sie Ihre E-Mail-Adresse an." };
	}

	const user = getUserByEmail(email);

	if (user && !user.emailVerified) {
		if (isSmtpConfigured()) {
			const token = await createVerificationToken(email);
			await sendVerificationEmail(email, token);
		} else {
			// Ohne SMTP ist kein Versand möglich - die Adresse direkt als
			// bestätigt markieren (analog zum Self-Healing im Login).
			markEmailVerified(email);
		}
	}

	if (!isSmtpConfigured()) {
		return {
			success: true,
			message:
				"Falls ein Konto mit dieser E-Mail-Adresse existiert und noch nicht bestätigt war, wurde die Adresse jetzt bestätigt. Sie können sich anmelden.",
		};
	}

	return {
		success: true,
		message: "Falls ein Konto mit dieser E-Mail-Adresse existiert und noch nicht bestätigt wurde, haben wir eine neue Bestätigungs-E-Mail versendet.",
	};
}
