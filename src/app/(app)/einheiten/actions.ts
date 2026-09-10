"use server";

import { revalidatePath } from "next/cache";

import { createUnit, deleteUnit, getUnit, updateUnit } from "@/data/units";
import { requireUser } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { ActionState } from "@/lib/action-state";
import { getT } from "@/lib/i18n/server";

function getString(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === "string" ? value.trim() : "";
}

function getOptionalFloat(formData: FormData, key: string): number | null {
	const raw = getString(formData, key);
	if (!raw) return null;
	const parsed = Number(raw.replace(",", "."));
	return Number.isNaN(parsed) ? null : parsed;
}

export async function saveUnitAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const id = getString(formData, "id");
	const propertyId = getString(formData, "propertyId");
	const label = getString(formData, "label");
	const floor = getString(formData, "floor");
	const livingSpace = getOptionalFloat(formData, "livingSpace");
	const rooms = getOptionalFloat(formData, "rooms");
	// Miteigentumsanteil (MEA, Zähler; Nenner = hoas.totalShares der WEG) -
	// nur relevant, wenn die Liegenschaft dieser Einheit eine WEG ist (siehe
	// src/app/(app)/weg/**), aber additiv auf jeder Einheit pflegbar.
	const coOwnershipShare = getOptionalFloat(formData, "coOwnershipShare");

	if (!propertyId || !label) {
		return { error: t("units.errors.requiredFields") };
	}

	const data = {
		propertyId,
		label,
		floor: floor || null,
		livingSpace,
		rooms,
		coOwnershipShare,
	};

	try {
		if (id) {
			updateUnit(id, data);
			logActivity(user, "UPDATE", "einheiten", `Einheit „${label}“ bearbeitet`, id);
		} else {
			const unit = createUnit(data);
			logActivity(user, "CREATE", "einheiten", `Einheit „${label}“ angelegt`, unit.id);
		}
	} catch (error) {
		console.error("saveUnitAction failed", error);
		return { error: t("units.errors.saveFailed") };
	}

	revalidatePath("/einheiten");
	revalidatePath("/liegenschaften");
	revalidatePath("/");
	return { success: true };
}

export async function deleteUnitAction(id: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	// Bezeichnung vor dem Löschen ermitteln (für den Log-Eintrag).
	const unit = getUnit(id);
	try {
		deleteUnit(id);
	} catch (error) {
		console.error("deleteUnitAction failed", error);
		return {
			error: t("units.errors.deleteFailed"),
		};
	}

	logActivity(user, "DELETE", "einheiten", `Einheit „${unit ? unit.label : id}“ gelöscht`, id);

	revalidatePath("/einheiten");
	revalidatePath("/liegenschaften");
	revalidatePath("/");
	return { success: true };
}
