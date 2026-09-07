"use server";

import { redirect } from "next/navigation";

import { getUserByEmail } from "@/data/users";
import { verifyPasswordTimingSafe } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
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
		return {
			error: "Ihre E-Mail-Adresse wurde noch nicht bestätigt.",
			unverifiedEmail: user.email,
		};
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
