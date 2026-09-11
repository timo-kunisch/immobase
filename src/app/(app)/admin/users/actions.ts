"use server";

import { revalidatePath } from "next/cache";

import { getUserById, updateUserApproval, updateUserName } from "@/data/users";
import { requireAdmin } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { destroyAllSessionsForUser } from "@/lib/auth/session";
import { MAX_NAME_LENGTH, normalizeName } from "@/lib/auth/validation";
import { isSmtpConfigured, sendAccountApprovedEmail } from "@/lib/email/mailer";
import { getT } from "@/lib/i18n/server";
import { ActionState } from "@/lib/action-state";
import { userDisplayName } from "@/lib/user-name";

/**
 * Setzt/entzieht die Freigabe (isApproved) eines Nutzers. Nur für Admins
 * zugänglich (requireAdmin() wirft/leitet um, falls kein Admin).
 *
 * Sicherheitsmaßnahmen:
 * - Ein Admin kann sich nicht selbst die Freigabe entziehen (Aussperr-Schutz).
 * - Beim Entzug der Freigabe werden alle aktiven Sessions des Nutzers
 *   sofort beendet (sonst bliebe ein bereits angemeldeter Browser bis zum
 *   Session-Ablauf weiter eingeloggt).
 */
export async function toggleUserApprovalAction(userId: string, isApproved: boolean): Promise<ActionState> {
	const admin = await requireAdmin();
	const t = await getT();

	if (userId === admin.id) {
		return { error: t("admin.users.errors.selfToggle") };
	}

	const targetUser = getUserById(userId);
	if (!targetUser) {
		return { error: t("admin.users.errors.notFound") };
	}

	updateUserApproval(userId, isApproved);
	// Anzeige-Name statt E-Mail-Adresse (Fallback E-Mail bei Altkonten).
	const displayName = userDisplayName(targetUser);
	logActivity(
		admin,
		"UPDATE",
		"admin",
		isApproved ? `Kontofreigabe für „${displayName}“ erteilt` : `Kontofreigabe für „${displayName}“ entzogen`,
		userId
	);

	if (!isApproved) {
		await destroyAllSessionsForUser(userId);
		revalidatePath("/admin/users");
		return { success: true };
	}

	// Freigabe erteilt: Benachrichtigungs-E-Mail an den Nutzer. Diese hängt
	// an der optionalen SMTP-Integration - ohne konfigurierten Server sind
	// alle E-Mail-Funktionen deaktiviert (siehe src/lib/email/mailer.ts);
	// der Admin erhält dann einen Hinweis im Ergebnis.
	if (targetUser.emailVerified) {
		if (!isSmtpConfigured()) {
			revalidatePath("/admin/users");
			return {
				success: true,
				message: t("admin.users.success.approvedWithoutEmail"),
			};
		}
		// Best-effort-Benachrichtigung, Fehler beim Mailversand sollen die
		// Freigabe nicht rückgängig machen.
		await sendAccountApprovedEmail(targetUser.email).catch((error) => {
			console.error("sendAccountApprovedEmail failed", error);
		});
	}

	revalidatePath("/admin/users");
	return { success: true };
}

/**
 * Ändert Vor- und Nachname eines Nutzers (z. B. Korrektur oder Nachpflege
 * bei Altkonten, die vor der Einführung der Namensfelder angelegt wurden).
 * Vor-/Nachname sind - wie bei Registrierung und Setup - Pflichtfelder,
 * damit der Name als Bezeichnung des Nutzers dienen kann.
 */
export async function updateUserNameAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const admin = await requireAdmin();
	const t = await getT();

	const userId = String(formData.get("userId") ?? "");
	const firstName = normalizeName(String(formData.get("firstName") ?? ""));
	if (firstName.error) {
		return { error: t(firstName.error, { max: MAX_NAME_LENGTH }) };
	}
	const lastName = normalizeName(String(formData.get("lastName") ?? ""));
	if (lastName.error) {
		return { error: t(lastName.error, { max: MAX_NAME_LENGTH }) };
	}
	if (!firstName.name || !lastName.name) {
		return { error: t("auth.errors.nameRequired") };
	}

	const targetUser = getUserById(userId);
	if (!targetUser) {
		return { error: t("admin.users.errors.notFound") };
	}

	updateUserName(userId, firstName.name, lastName.name);
	logActivity(
		admin,
		"UPDATE",
		"admin",
		`Name von „${userDisplayName(targetUser)}“ zu „${userDisplayName({
			...targetUser,
			firstName: firstName.name,
			lastName: lastName.name,
		})}“ geändert`,
		userId
	);

	revalidatePath("/admin/users");
	return { success: true };
}
