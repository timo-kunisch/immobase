"use server";

import { redirect } from "next/navigation";

import { countUsers, createUser, getUserByEmail } from "@/data/users";
import { ActionState } from "@/lib/action-state";
import { hashPassword } from "@/lib/auth/password";
import { createVerificationToken } from "@/lib/auth/tokens";
import { sendVerificationEmail } from "@/lib/email/mailer";
import { isValidEmail, normalizeEmail, validatePassword } from "@/lib/auth/validation";

/**
 * Registrierung neuer Nutzer – Bootstrapping-Muster:
 * - Der ERSTE Nutzer im System wird automatisch ADMIN und ist sofort
 *   freigeschaltet (isApproved = true).
 * - Alle weiteren Registrierungen sind USER und benötigen zusätzlich die
 *   Freigabe durch einen Administrator unter /admin/users.
 * - In JEDEM Fall (auch für den ersten Admin) wird eine Verifizierungs-
 *   E-Mail versendet; ein Login ist erst nach Bestätigung der E-Mail
 *   möglich.
 *
 * Hinweis: Bei zwei exakt gleichzeitigen Erst-Registrierungen könnten
 * theoretisch beide Anfragen "userCount === 0" sehen und beide Admin
 * werden (Race Condition). Für dieses interne, kleine Verwaltungstool ist
 * dieses Risiko bewusst akzeptiert statt mit einer Datenbank-Sperre o. Ä.
 * abgesichert zu werden.
 */
export async function registerAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const email = normalizeEmail(String(formData.get("email") ?? ""));
	const password = String(formData.get("password") ?? "");
	const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

	if (!isValidEmail(email)) {
		return { error: "Bitte geben Sie eine gültige E-Mail-Adresse an." };
	}

	const passwordError = validatePassword(password);
	if (passwordError) {
		return { error: passwordError };
	}

	if (password !== passwordConfirm) {
		return { error: "Die Passwörter stimmen nicht überein." };
	}

	const existing = getUserByEmail(email);
	if (existing) {
		return { error: "Für diese E-Mail-Adresse existiert bereits ein Konto." };
	}

	const isFirstUser = countUsers() === 0;
	const passwordHash = await hashPassword(password);

	createUser({
		email,
		passwordHash,
		role: isFirstUser ? "ADMIN" : "USER",
		isApproved: isFirstUser,
	});

	const token = await createVerificationToken(email);
	await sendVerificationEmail(email, token);

	redirect(`/login?registered=1${isFirstUser ? "&firstAdmin=1" : ""}&email=${encodeURIComponent(email)}`);
}
