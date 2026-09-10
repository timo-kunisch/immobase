"use server";

import { redirect } from "next/navigation";

import { countUsers, getUserByEmail } from "@/data/users";
import { logActivity } from "@/lib/audit";
import { ActionState } from "@/lib/action-state";
import { provisionUserAccount } from "@/lib/auth/bootstrap";
import { getT } from "@/lib/i18n/server";
import { isValidEmail, MIN_PASSWORD_LENGTH, normalizeEmail, validatePassword } from "@/lib/auth/validation";

/**
 * Registrierung neuer Nutzer – Bootstrapping-Muster (siehe
 * src/lib/auth/bootstrap.ts): Der erste Nutzer wird automatisch ADMIN und
 * ist sofort freigeschaltet, alle weiteren sind USER und benötigen die
 * Freigabe durch einen Administrator.
 *
 * Hinweis: Bei zwei exakt gleichzeitigen Erst-Registrierungen könnten
 * theoretisch beide Anfragen "userCount === 0" sehen und beide Admin
 * werden (Race Condition). Für dieses interne, kleine Verwaltungstool ist
 * dieses Risiko bewusst akzeptiert statt mit einer Datenbank-Sperre o. Ä.
 * abgesichert zu werden.
 */
export async function registerAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
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

	const existing = getUserByEmail(email);
	if (existing) {
		return { error: t("auth.errors.emailTaken") };
	}

	const isFirstUser = countUsers() === 0;
	const { emailSent } = await provisionUserAccount(email, password, isFirstUser);
	// Registrierungen sind für Admins relevant (Freigabe-Workflow) - der
	// Nutzer ist hier noch nicht angemeldet, daher userId = null.
	logActivity(
		{ id: null, email },
		"CREATE",
		"admin",
		isFirstUser ? `Benutzerkonto „${email}“ registriert (erster Administrator)` : `Benutzerkonto „${email}“ registriert (wartet auf Freigabe)`
	);

	redirect(
		`/login?registered=1${isFirstUser ? "&firstAdmin=1" : ""}${emailSent ? "&emailSent=1" : ""}&email=${encodeURIComponent(email)}`
	);
}
