"use server";

import { redirect } from "next/navigation";

import { getUserByEmail, updateUserPassword } from "@/data/users";
import { ActionState } from "@/lib/action-state";
import { hashPassword } from "@/lib/auth/password";
import { consumePasswordResetToken } from "@/lib/auth/tokens";
import { destroyAllSessionsForUser } from "@/lib/auth/session";
import { validatePassword } from "@/lib/auth/validation";

export async function resetPasswordAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const token = String(formData.get("token") ?? "");
	const password = String(formData.get("password") ?? "");
	const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

	if (!token) {
		return { error: "Ungültiger oder fehlender Token." };
	}

	const passwordError = validatePassword(password);
	if (passwordError) {
		return { error: passwordError };
	}

	if (password !== passwordConfirm) {
		return { error: "Die Passwörter stimmen nicht überein." };
	}

	const result = await consumePasswordResetToken(token);
	if (!result.success) {
		return { error: result.error };
	}

	const user = getUserByEmail(result.identifier);
	if (!user) {
		return { error: "Zu diesem Link wurde kein Konto gefunden." };
	}

	const passwordHash = await hashPassword(password);
	updateUserPassword(user.id, passwordHash);

	// Alle bestehenden Sessions dieses Nutzers beenden – nach einem
	// Passwort-Reset sollen alte, ggf. kompromittierte Sitzungen ungültig
	// werden.
	await destroyAllSessionsForUser(user.id);

	redirect("/login?passwordReset=1");
}
