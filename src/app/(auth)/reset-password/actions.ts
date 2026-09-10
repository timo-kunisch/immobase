"use server";

import { redirect } from "next/navigation";

import { getUserByEmail, updateUserPassword } from "@/data/users";
import { ActionState } from "@/lib/action-state";
import { hashPassword } from "@/lib/auth/password";
import { consumePasswordResetToken } from "@/lib/auth/tokens";
import { destroyAllSessionsForUser } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { MIN_PASSWORD_LENGTH, validatePassword } from "@/lib/auth/validation";

export async function resetPasswordAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const t = await getT();
	const token = String(formData.get("token") ?? "");
	const password = String(formData.get("password") ?? "");
	const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

	if (!token) {
		return { error: t("auth.errors.tokenMissing") };
	}

	const passwordError = validatePassword(password);
	if (passwordError) {
		return { error: t(passwordError, { min: MIN_PASSWORD_LENGTH }) };
	}

	if (password !== passwordConfirm) {
		return { error: t("auth.errors.passwordMismatch") };
	}

	const result = await consumePasswordResetToken(token);
	if (!result.success) {
		return { error: t(result.errorKey) };
	}

	const user = getUserByEmail(result.identifier);
	if (!user) {
		return { error: t("auth.errors.noAccountForToken") };
	}

	const passwordHash = await hashPassword(password);
	updateUserPassword(user.id, passwordHash);

	// Alle bestehenden Sessions dieses Nutzers beenden – nach einem
	// Passwort-Reset sollen alte, ggf. kompromittierte Sitzungen ungültig
	// werden.
	await destroyAllSessionsForUser(user.id);

	redirect("/login?passwordReset=1");
}
