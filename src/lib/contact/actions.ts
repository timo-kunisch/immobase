"use server";

import { listAdminEmails } from "@/data/users";
import { requireUser } from "@/lib/auth/dal";
import { isSmtpConfigured, sendContactAdminEmail } from "@/lib/email/mailer";
import { ActionState } from "@/lib/action-state";

const MAX_MESSAGE_LENGTH = 5000;

/**
 * Nachricht eines angemeldeten Nutzers an alle Administratoren (Dialog im
 * Sidebar-Footer, siehe components/layout/contact-admin-dialog.tsx).
 */
export async function sendContactMessageAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();

	// Ohne konfigurierten SMTP-Server sind alle E-Mail-Funktionen
	// deaktiviert (siehe src/lib/email/mailer.ts) - der Versand ist dann
	// gesperrt.
	if (!isSmtpConfigured()) {
		return { error: "Nachrichten können derzeit nicht versendet werden, weil kein E-Mail-Server konfiguriert ist." };
	}

	const message = String(formData.get("message") ?? "").trim();

	if (!message) {
		return { error: "Bitte geben Sie eine Nachricht ein." };
	}
	if (message.length > MAX_MESSAGE_LENGTH) {
		return { error: `Die Nachricht darf höchstens ${MAX_MESSAGE_LENGTH} Zeichen lang sein.` };
	}

	const adminEmails = listAdminEmails();

	try {
		await Promise.all(adminEmails.map((email) => sendContactAdminEmail(email, user.email, message)));
	} catch (error) {
		console.error("sendContactMessageAction failed", error);
		return { error: "Die Nachricht konnte nicht versendet werden. Bitte versuchen Sie es später erneut." };
	}

	return { success: true, message: "Ihre Nachricht wurde an die Administratoren gesendet." };
}
