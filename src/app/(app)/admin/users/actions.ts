"use server";

import { revalidatePath } from "next/cache";

import { getUserById, updateUserApproval } from "@/data/users";
import { requireAdmin } from "@/lib/auth/dal";
import { destroyAllSessionsForUser } from "@/lib/auth/session";
import { isSmtpConfigured, sendAccountApprovedEmail } from "@/lib/email/mailer";
import { ActionState } from "@/lib/action-state";

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

	if (userId === admin.id) {
		return { error: "Sie können Ihren eigenen Freigabestatus nicht ändern." };
	}

	const targetUser = getUserById(userId);
	if (!targetUser) {
		return { error: "Nutzer nicht gefunden." };
	}

	updateUserApproval(userId, isApproved);

	if (!isApproved) {
		await destroyAllSessionsForUser(userId);
		revalidatePath("/admin/users");
		return { success: true };
	}

	// Freigabe erteilt: Benachrichtigungs-E-Mail an den Nutzer. Diese hängt
	// an der optionalen SMTP-Integration - ohne konfigurierten Server würde
	// die Mail nur in der Outbox-Logdatei landen (siehe
	// src/lib/email/mailer.ts); der Versand ist dann deaktiviert und der
	// Admin erhält einen Hinweis im Ergebnis.
	if (targetUser.emailVerified) {
		if (!isSmtpConfigured()) {
			revalidatePath("/admin/users");
			return {
				success: true,
				message:
					"Freigabe erteilt. Hinweis: Es ist kein E-Mail-Server konfiguriert (Einstellungen → Online-Integrationen) - der Nutzer wurde nicht per E-Mail benachrichtigt.",
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
