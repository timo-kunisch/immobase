"use server";

import { revalidatePath } from "next/cache";

import { createCalendarEvent, deleteCalendarEvent, getCalendarEvent, updateCalendarEvent } from "@/data/calendar-events";
import { requireUser } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { ActionState } from "@/lib/action-state";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";

function getString(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === "string" ? value.trim() : "";
}

export async function saveCalendarEventAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const id = getString(formData, "id");
	const title = getString(formData, "title");
	const startDate = getString(formData, "startDate");
	const endDateRaw = getString(formData, "endDate");
	const description = getString(formData, "description");

	if (!title || !startDate) {
		return { error: t("calendar.errors.titleAndStartRequired") };
	}

	const endDate = endDateRaw || null;
	if (endDate && endDate < startDate) {
		return { error: t("calendar.errors.endBeforeStart") };
	}

	const data = { title, description: description || null, startDate, endDate };

	try {
		if (id) {
			updateCalendarEvent(id, data);
			logActivity(user, "UPDATE", "kalender", `Kalender-Ereignis „${title}“ (${formatDate(startDate)}) bearbeitet`, id);
		} else {
			const event = createCalendarEvent(data);
			logActivity(user, "CREATE", "kalender", `Kalender-Ereignis „${title}“ (${formatDate(startDate)}) angelegt`, event.id);
		}
	} catch (error) {
		console.error("saveCalendarEventAction failed", error);
		return { error: t("calendar.errors.saveFailed") };
	}

	revalidatePath("/kalender");
	return { success: true };
}

export async function deleteCalendarEventAction(id: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	// Bezeichnung vor dem Löschen ermitteln (für den Log-Eintrag).
	const event = getCalendarEvent(id);
	try {
		deleteCalendarEvent(id);
	} catch (error) {
		console.error("deleteCalendarEventAction failed", error);
		return { error: t("calendar.errors.deleteFailed") };
	}

	logActivity(user, "DELETE", "kalender", `Kalender-Ereignis „${event ? event.title : id}“ gelöscht`, id);

	revalidatePath("/kalender");
	return { success: true };
}
