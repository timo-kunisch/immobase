"use server";

import { revalidatePath } from "next/cache";

import { createHousingCharge, deleteHousingCharge, markHousingChargePaid, updateHousingCharge } from "@/data/housing-charges";
import { requireUser } from "@/lib/auth/dal";
import { ActionState } from "@/lib/action-state";
import { getString, getDecimalString } from "@/lib/form-data";
import type { HousingChargeStatus } from "@/data/types";

const HOUSING_CHARGE_STATUSES: HousingChargeStatus[] = ["OPEN", "PAID", "OVERDUE", "CANCELLED"];

/** Manuelles CRUD für Hausgeld-Sollstellungen (housingCharges) - analog zu src/app/(app)/finanzen/actions.ts (transactions). */

export async function saveHousingChargeAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	const id = getString(formData, "id");
	const unitId = getString(formData, "unitId");
	const ownerId = getString(formData, "ownerId");
	const dueDateRaw = getString(formData, "dueDate");
	const purpose = getString(formData, "purpose");
	const statusRaw = getString(formData, "status") as HousingChargeStatus;
	const amount = getDecimalString(formData, "amount");

	if (!unitId || !ownerId || !dueDateRaw || amount === null) {
		return { error: "Bitte Einheit, Eigentümer, Fälligkeitsdatum und Betrag angeben." };
	}

	const status: HousingChargeStatus = HOUSING_CHARGE_STATUSES.includes(statusRaw) ? statusRaw : "OPEN";

	const data = {
		unitId,
		ownerId,
		amount,
		dueDate: new Date(dueDateRaw).toISOString(),
		purpose: purpose || null,
		status,
		paidDate: status === "PAID" ? new Date().toISOString() : null,
	};

	try {
		if (id) {
			updateHousingCharge(id, data);
		} else {
			createHousingCharge(data);
		}
	} catch (error) {
		console.error("saveHousingChargeAction failed", error);
		return { error: "Die Hausgeld-Sollstellung konnte nicht gespeichert werden." };
	}

	revalidatePath(`/weg/hausgeld`);
	return { success: true };
}

/** Schnellaktion: Sollstellung direkt aus der Tabelle als "bezahlt" markieren. */
export async function markHousingChargePaidAction(id: string, _hoaId: string): Promise<ActionState> {
	await requireUser();
	try {
		markHousingChargePaid(id);
	} catch (error) {
		console.error("markHousingChargePaidAction failed", error);
		return { error: "Sollstellung konnte nicht als bezahlt markiert werden." };
	}

	revalidatePath(`/weg/hausgeld`);
	return { success: true };
}

export async function deleteHousingChargeAction(id: string, _hoaId: string): Promise<ActionState> {
	await requireUser();
	try {
		deleteHousingCharge(id);
	} catch (error) {
		console.error("deleteHousingChargeAction failed", error);
		return { error: "Die Hausgeld-Sollstellung konnte nicht gelöscht werden." };
	}

	revalidatePath(`/weg/hausgeld`);
	return { success: true };
}
