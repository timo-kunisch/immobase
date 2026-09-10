"use server";

import { redirect } from "next/navigation";

import { getUserByEmail, markEmailVerified } from "@/data/users";
import { logActivity } from "@/lib/audit";
import { verifyPasswordTimingSafe } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { isSmtpConfigured } from "@/lib/email/mailer";
import { normalizeEmail } from "@/lib/auth/validation";
import type { LoginState } from "@/lib/auth/login-state";
import { getT } from "@/lib/i18n/server";

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
	const t = await getT();
	const email = normalizeEmail(String(formData.get("email") ?? ""));
	const password = String(formData.get("password") ?? "");

	if (!email || !password) {
		return { error: t("auth.errors.credentialsRequired") };
	}

	const user = getUserByEmail(email);

	// Passwort immer prüfen (auch bei nicht existierendem Account, gegen
	// einen fixen Dummy-Hash) – verhindert, dass die Antwortzeit verrät, ob
	// die E-Mail-Adresse überhaupt registriert ist.
	const passwordValid = await verifyPasswordTimingSafe(password, user?.passwordHash);

	if (!user || !passwordValid) {
		return { error: t("auth.errors.invalidCredentials") };
	}

	if (!user.emailVerified) {
		if (isSmtpConfigured()) {
			return {
				error: t("auth.errors.emailNotVerified"),
				unverifiedEmail: user.email,
			};
		}
		// Offline-Fallback (Normalfall der Desktop-App): Ohne SMTP sind alle
		// E-Mail-Funktionen deaktiviert - eine Verifizierungs-Mail kann
		// niemanden erreichen. Der Schritt bringt dann keinen
		// Sicherheitsgewinn (wer die App lokal kontrolliert, hat ohnehin
		// vollen Datenbankzugriff), blockiert aber den Login. Daher wird die
		// Adresse hier - nach erfolgreicher Passwortprüfung - automatisch
		// bestätigt. Das heilt auch Konten, die noch aus einer Konstellation
		// mit erzwungener Verifizierung stammen.
		markEmailVerified(user.email);
		console.info(`[auth] E-Mail-Adresse ${user.email} automatisch bestätigt (kein SMTP konfiguriert).`);
	}

	if (!user.isApproved) {
		return {
			error: t("auth.errors.notApproved"),
		};
	}

	await createSession(user.id);
	logActivity(user, "LOGIN", "auth", "Angemeldet", user.id);

	const from = String(formData.get("from") ?? "");
	const safeFrom = from && from.startsWith("/") && !from.startsWith("//") ? from : "/";
	redirect(safeFrom);
}
