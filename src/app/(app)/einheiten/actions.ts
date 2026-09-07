"use server";

import { revalidatePath } from "next/cache";

import { createUnit, deleteUnit, updateUnit } from "@/data/units";
import { requireUser } from "@/lib/auth/dal";
import { ActionState } from "@/lib/action-state";

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
	await requireUser();
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
		return { error: "Bitte wählen Sie eine Liegenschaft und vergeben Sie eine Bezeichnung." };
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
		} else {
			createUnit(data);
		}
	} catch (error) {
		console.error("saveUnitAction failed", error);
		return { error: "Die Einheit konnte nicht gespeichert werden." };
	}

	revalidatePath("/einheiten");
	revalidatePath("/liegenschaften");
	revalidatePath("/");
	return { success: true };
}

export async function deleteUnitAction(id: string): Promise<ActionState> {
	await requireUser();
	try {
		deleteUnit(id);
	} catch (error) {
		console.error("deleteUnitAction failed", error);
		return {
			error: "Löschen fehlgeschlagen. Bitte entfernen Sie zuerst alle zugehörigen Mietverträge.",
		};
	}

	revalidatePath("/einheiten");
	revalidatePath("/liegenschaften");
	revalidatePath("/");
	return { success: true };
}
