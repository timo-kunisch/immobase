"use server";

import { redirect } from "next/navigation";

import { getUserByEmail, markEmailVerified } from "@/data/users";
import { verifyPasswordTimingSafe } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { isSmtpConfigured } from "@/lib/email/mailer";
import { normalizeEmail } from "@/lib/auth/validation";
import type { LoginState } from "@/lib/auth/login-state";

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
	const email = normalizeEmail(String(formData.get("email") ?? ""));
	const password = String(formData.get("password") ?? "");

	if (!email || !password) {
		return { error: "Bitte geben Sie E-Mail-Adresse und Passwort an." };
	}

	const user = getUserByEmail(email);

	// Passwort immer prüfen (auch bei nicht existierendem Account, gegen
	// einen fixen Dummy-Hash) – verhindert, dass die Antwortzeit verrät, ob
	// die E-Mail-Adresse überhaupt registriert ist.
	const passwordValid = await verifyPasswordTimingSafe(password, user?.passwordHash);

	if (!user || !passwordValid) {
		return { error: "E-Mail-Adresse oder Passwort ist falsch." };
	}

	if (!user.emailVerified) {
		if (isSmtpConfigured()) {
			return {
				error: "Ihre E-Mail-Adresse wurde noch nicht bestätigt.",
				unverifiedEmail: user.email,
			};
		}
		// Offline-Fallback (Normalfall der Desktop-App): Ohne SMTP kann die
		// Verifizierungs-Mail niemanden erreichen - sie landet nur in
		// logs/outbox.log auf diesem Rechner. Der Schritt bringt dann keinen
		// Sicherheitsgewinn (wer die Datei lesen kann, hat ohnehin vollen
		// Datenbankzugriff), blockiert aber den Login. Daher wird die Adresse
		// hier - nach erfolgreicher Passwortprüfung - automatisch bestätigt.
		// Das heilt auch Konten, die noch aus einer Konstellation mit
		// erzwungener Verifizierung stammen.
		markEmailVerified(user.email);
		console.info(`[auth] E-Mail-Adresse ${user.email} automatisch bestätigt (kein SMTP konfiguriert).`);
	}

	if (!user.isApproved) {
		return {
			error: "Ihr Konto wartet noch auf die Freigabe durch einen Administrator.",
		};
	}

	await createSession(user.id);

	const from = String(formData.get("from") ?? "");
	const safeFrom = from && from.startsWith("/") && !from.startsWith("//") ? from : "/";
	redirect(safeFrom);
}
