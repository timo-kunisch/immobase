"use server";

import { revalidatePath } from "next/cache";

import { logTicketActivity } from "@/data/ticket-activity";
import { getTicketMessage, convertMessageToTicket, deleteMailboxMessage, linkMessageToTicket } from "@/data/ticket-messages";
import { getTicket } from "@/data/tickets";
import { requireUser } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { ActionState } from "@/lib/action-state";
import { getT } from "@/lib/i18n/server";

function getString(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === "string" ? value.trim() : "";
}

function revalidateMailbox() {
	revalidatePath("/postfach");
	revalidatePath("/tickets");
	revalidatePath("/");
}

/**
 * Manueller Abruf des IMAP-Postfachs (Button im Postfach). Der eigentliche
 * Abruf liegt in src/lib/email/imap-sync.ts (dort auch der Scheduler).
 */
export async function syncMailboxAction(): Promise<ActionState> {
	await requireUser();
	const t = await getT();
	const { syncImapMailbox } = await import("@/lib/email/imap-sync");
	const result = await syncImapMailbox();
	revalidateMailbox();
	if (result.error) {
		return { error: t("tickets.mailbox.errors.syncFailed", { detail: result.error }) };
	}
	const linked = result.linked > 0 ? t("tickets.mailbox.success.syncedLinked", { count: result.linked }) : "";
	return { success: true, message: t("tickets.mailbox.success.synced", { imported: result.imported, linked }) };
}

/**
 * Wandelt eine Postfach-Nachricht in ein neues Ticket um (Titel/Beschreibung
 * sind aus Betreff/Inhalt vorbefüllt, die Liegenschaft ist optional).
 */
export async function convertMessageToTicketAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const messageId = getString(formData, "messageId");
	const propertyIdRaw = getString(formData, "propertyId");
	const propertyId = propertyIdRaw === "none" ? null : propertyIdRaw || null;
	const unitIdRaw = getString(formData, "unitId");
	const unitId = unitIdRaw === "none" ? "" : unitIdRaw;
	const title = getString(formData, "title");
	const description = getString(formData, "description");

	if (!messageId || !title) {
		return { error: t("tickets.errors.missingTitle") };
	}

	const message = getTicketMessage(messageId);
	if (!message || message.direction !== "INBOUND") {
		return { error: t("tickets.errors.emailNotFound") };
	}
	if (message.ticketId) {
		return { error: t("tickets.mailbox.errors.alreadyLinked") };
	}

	try {
		const ticket = convertMessageToTicket(messageId, {
			propertyId,
			// Eine Einheit ist nur sinnvoll mit Liegenschaft wählbar.
			unitId: propertyId ? unitId || null : null,
			title,
			description: description || null,
			status: "OPEN",
			resolvedAt: null,
		});
		// Herkunft im Ticket-Verlauf festhalten („aus E-Mail …"), die E-Mail
		// selbst wird als erster Verlaufs-Eintrag sichtbar.
		logTicketActivity({
			ticketId: ticket.id,
			action: "CREATED",
			toValue: "OPEN",
			detail: message.subject,
			actorUserId: user.id,
			actorEmail: user.email,
		});
		logActivity(user, "CREATE", "tickets", `Ticket „${title}“ aus E-Mail „${message.subject ?? "(ohne Betreff)"}“ angelegt`, ticket.id);
	} catch (error) {
		console.error("convertMessageToTicketAction failed", error);
		return { error: t("tickets.mailbox.errors.convertFailed") };
	}

	revalidateMailbox();
	return { success: true };
}

/** Heftet eine Postfach-Nachricht an ein bestehendes Ticket an. */
export async function linkMessageToTicketAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const messageId = getString(formData, "messageId");
	const ticketId = getString(formData, "ticketId");

	if (!messageId || !ticketId) {
		return { error: t("tickets.errors.selectTicket") };
	}

	const message = getTicketMessage(messageId);
	if (!message || message.direction !== "INBOUND") {
		return { error: t("tickets.errors.emailNotFound") };
	}
	if (message.ticketId) {
		return { error: t("tickets.mailbox.errors.alreadyLinked") };
	}
	const ticket = getTicket(ticketId);
	if (!ticket) {
		return { error: t("tickets.errors.targetTicketNotFound") };
	}

	try {
		linkMessageToTicket(messageId, ticketId);
		// Die E-Mail erscheint im Verlauf - der Eintrag hält zusätzlich fest,
		// dass (und von wem) sie gezielt diesem Ticket zugeordnet wurde.
		logTicketActivity({
			ticketId,
			action: "EMAIL_LINKED",
			detail: message.subject,
			actorUserId: user.id,
			actorEmail: user.email,
		});
		logActivity(user, "UPDATE", "tickets", `E-Mail „${message.subject ?? "(ohne Betreff)"}“ dem Ticket „${ticket.title}“ zugeordnet`, ticketId);
	} catch (error) {
		console.error("linkMessageToTicketAction failed", error);
		return { error: t("tickets.mailbox.errors.linkFailed") };
	}

	revalidateMailbox();
	return { success: true };
}

/**
 * Entfernt eine E-Mail aus dem Postfach (nur die lokale Kopie in der App;
 * die Nachricht auf dem IMAP-Server bleibt unberührt und wird wegen des
 * Abgleichstands nicht erneut importiert).
 */
export async function deleteMailboxMessageAction(id: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	// Bezeichnung vor dem Löschen ermitteln (für den Log-Eintrag).
	const message = getTicketMessage(id);
	try {
		deleteMailboxMessage(id);
	} catch (error) {
		console.error("deleteMailboxMessageAction failed", error);
		return { error: t("tickets.mailbox.errors.deleteFailed") };
	}

	if (message) {
		logActivity(user, "DELETE", "postfach", `E-Mail „${message.subject ?? "(ohne Betreff)"}“ aus dem Postfach gelöscht`, id);
	}

	revalidateMailbox();
	return { success: true };
}
