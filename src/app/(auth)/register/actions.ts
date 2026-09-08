"use server";

import { redirect } from "next/navigation";

import { countUsers, getUserByEmail } from "@/data/users";
import { ActionState } from "@/lib/action-state";
import { provisionUserAccount } from "@/lib/auth/bootstrap";
import { isValidEmail, normalizeEmail, validatePassword } from "@/lib/auth/validation";

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
	const { emailSent } = await provisionUserAccount(email, password, isFirstUser);

	redirect(
		`/login?registered=1${isFirstUser ? "&firstAdmin=1" : ""}${emailSent ? "&emailSent=1" : ""}&email=${encodeURIComponent(email)}`
	);
}
