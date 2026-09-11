"use server";

import { redirect } from "next/navigation";

import { countUsers, getUserByEmail } from "@/data/users";
import { logActivity } from "@/lib/audit";
import { ActionState } from "@/lib/action-state";
import { provisionUserAccount } from "@/lib/auth/bootstrap";
import { getT } from "@/lib/i18n/server";
import { isValidEmail, MAX_NAME_LENGTH, MIN_PASSWORD_LENGTH, normalizeEmail, normalizeName, validatePassword } from "@/lib/auth/validation";
import { userDisplayName } from "@/lib/user-name";

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

	const firstName = normalizeName(String(formData.get("firstName") ?? ""));
	if (firstName.error) {
		return { error: t(firstName.error, { max: MAX_NAME_LENGTH }) };
	}
	const lastName = normalizeName(String(formData.get("lastName") ?? ""));
	if (lastName.error) {
		return { error: t(lastName.error, { max: MAX_NAME_LENGTH }) };
	}
	// Vor- und Nachname sind Pflichtfelder, damit der Name (statt der
	// E-Mail-Adresse) als Bezeichnung des Nutzers dienen kann.
	if (!firstName.name || !lastName.name) {
		return { error: t("auth.errors.nameRequired") };
	}

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
	const { emailSent } = await provisionUserAccount(email, password, isFirstUser, {
		firstName: firstName.name,
		lastName: lastName.name,
	});
	// Registrierungen sind für Admins relevant (Freigabe-Workflow) - der
	// Nutzer ist hier noch nicht angemeldet, daher userId = null.
	const displayName = userDisplayName({ email, firstName: firstName.name, lastName: lastName.name });
	logActivity(
		{ id: null, email },
		"CREATE",
		"admin",
		isFirstUser
			? `Benutzerkonto „${displayName}“ registriert (erster Administrator)`
			: `Benutzerkonto „${displayName}“ registriert (wartet auf Freigabe)`
	);

	redirect(
		`/login?registered=1${isFirstUser ? "&firstAdmin=1" : ""}${emailSent ? "&emailSent=1" : ""}&email=${encodeURIComponent(email)}`
	);
}
