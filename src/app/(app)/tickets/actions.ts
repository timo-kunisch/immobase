"use server";

import { revalidatePath } from "next/cache";

import { createTicket, deleteTicket, updateTicket, updateTicketStatus } from "@/data/tickets";
import type { TicketStatus } from "@/data/types";
import { requireUser } from "@/lib/auth/dal";
import { ActionState } from "@/lib/action-state";

const TICKET_STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "DONE"];

function getString(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === "string" ? value.trim() : "";
}

export async function saveTicketAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	const id = getString(formData, "id");
	const propertyId = getString(formData, "propertyId");
	const unitIdRaw = getString(formData, "unitId");
	const unitId = unitIdRaw === "none" ? "" : unitIdRaw;
	const title = getString(formData, "title");
	const description = getString(formData, "description");
	const statusRaw = getString(formData, "status") as TicketStatus;
	const contractorNotes = getString(formData, "contractorNotes");

	if (!propertyId || !title) {
		return {
			error: "Bitte wählen Sie eine Liegenschaft und vergeben Sie einen Titel.",
		};
	}

	const status: TicketStatus = TICKET_STATUSES.includes(statusRaw) ? statusRaw : "OPEN";

	const data = {
		propertyId,
		unitId: unitId || null,
		title,
		description: description || null,
		status,
		contractorNotes: contractorNotes || null,
		resolvedAt: status === "DONE" ? new Date().toISOString() : null,
	};

	try {
		if (id) {
			updateTicket(id, data);
		} else {
			createTicket(data);
		}
	} catch (error) {
		console.error("saveTicketAction failed", error);
		return { error: "Das Ticket konnte nicht gespeichert werden." };
	}

	revalidatePath("/tickets");
	revalidatePath("/");
	return { success: true };
}

/** Schneller Status-Wechsel direkt aus der Kanban-Ansicht (ohne Dialog). */
export async function updateTicketStatusAction(id: string, status: TicketStatus): Promise<ActionState> {
	await requireUser();
	try {
		updateTicketStatus(id, status, status === "DONE" ? new Date().toISOString() : null);
	} catch (error) {
		console.error("updateTicketStatusAction failed", error);
		return { error: "Status konnte nicht geändert werden." };
	}

	revalidatePath("/tickets");
	revalidatePath("/");
	return { success: true };
}

export async function deleteTicketAction(id: string): Promise<ActionState> {
	await requireUser();
	try {
		deleteTicket(id);
	} catch (error) {
		console.error("deleteTicketAction failed", error);
		return { error: "Das Ticket konnte nicht gelöscht werden." };
	}

	revalidatePath("/tickets");
	revalidatePath("/");
	return { success: true };
}
