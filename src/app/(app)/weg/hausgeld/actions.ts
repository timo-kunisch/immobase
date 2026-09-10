"use server";

import { revalidatePath } from "next/cache";

import { createHousingCharge, deleteHousingCharge, markHousingChargePaid, updateHousingCharge } from "@/data/housing-charges";
import { requireUser } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { getT } from "@/lib/i18n/server";
import { ActionState } from "@/lib/action-state";
import { getString, getDecimalString } from "@/lib/form-data";
import type { HousingChargeStatus } from "@/data/types";

const HOUSING_CHARGE_STATUSES: HousingChargeStatus[] = ["OPEN", "PAID", "OVERDUE", "CANCELLED"];

/** Manuelles CRUD für Hausgeld-Sollstellungen (housingCharges) - analog zu src/app/(app)/finanzen/actions.ts (transactions). */

export async function saveHousingChargeAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const id = getString(formData, "id");
	const unitId = getString(formData, "unitId");
	const ownerId = getString(formData, "ownerId");
	const dueDateRaw = getString(formData, "dueDate");
	const purpose = getString(formData, "purpose");
	const statusRaw = getString(formData, "status") as HousingChargeStatus;
	const amount = getDecimalString(formData, "amount");

	if (!unitId || !ownerId || !dueDateRaw || amount === null) {
		return { error: t("hoaFinance.charges.errors.requiredFields") };
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

	// Verwendungszweck (z. B. „Hausgeld 1/2026“) als Bezeichnung, Fallback: Fälligkeitsdatum.
	const chargeLabel = purpose || dueDateRaw;

	try {
		if (id) {
			updateHousingCharge(id, data);
			logActivity(user, "UPDATE", "hausgeld", `Hausgeld-Sollstellung „${chargeLabel}“ bearbeitet`, id);
		} else {
			const charge = createHousingCharge(data);
			logActivity(user, "CREATE", "hausgeld", `Hausgeld-Sollstellung „${chargeLabel}“ angelegt`, charge.id);
		}
	} catch (error) {
		console.error("saveHousingChargeAction failed", error);
		return { error: t("hoaFinance.charges.errors.saveFailed") };
	}

	revalidatePath(`/weg/hausgeld`);
	return { success: true };
}

/** Schnellaktion: Sollstellung direkt aus der Tabelle als "bezahlt" markieren. */
export async function markHousingChargePaidAction(id: string, _hoaId: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	try {
		markHousingChargePaid(id);
	} catch (error) {
		console.error("markHousingChargePaidAction failed", error);
		return { error: t("hoaFinance.charges.errors.markPaidFailed") };
	}

	// Es gibt keine getX-Funktion für eine einzelne Sollstellung - Fallback auf die ID.
	logActivity(user, "UPDATE", "hausgeld", `Hausgeld-Sollstellung „${id}“ als bezahlt markiert`, id);

	revalidatePath(`/weg/hausgeld`);
	return { success: true };
}

export async function deleteHousingChargeAction(id: string, _hoaId: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	try {
		deleteHousingCharge(id);
	} catch (error) {
		console.error("deleteHousingChargeAction failed", error);
		return { error: t("hoaFinance.charges.errors.deleteFailed") };
	}

	logActivity(user, "DELETE", "hausgeld", `Hausgeld-Sollstellung „${id}“ gelöscht`, id);

	revalidatePath(`/weg/hausgeld`);
	return { success: true };
}
