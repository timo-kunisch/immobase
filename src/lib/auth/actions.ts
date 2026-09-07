"use server";

import { redirect } from "next/navigation";

import { getUserByEmail } from "@/data/users";
import { destroySession } from "@/lib/auth/session";
import { createVerificationToken } from "@/lib/auth/tokens";
import { sendVerificationEmail } from "@/lib/email/mailer";
import { normalizeEmail } from "@/lib/auth/validation";
import { ActionState } from "@/lib/action-state";

/** Meldet den aktuellen Nutzer ab (löscht Session in DB + Cookie). */
export async function logoutAction(): Promise<void> {
	await destroySession();
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
		const token = await createVerificationToken(email);
		await sendVerificationEmail(email, token);
	}

	return {
		success: true,
		message: "Falls ein Konto mit dieser E-Mail-Adresse existiert und noch nicht bestätigt wurde, haben wir eine neue Bestätigungs-E-Mail versendet.",
	};
}
