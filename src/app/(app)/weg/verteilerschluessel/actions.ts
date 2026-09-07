"use server";

import { revalidatePath } from "next/cache";

import { createCustomAllocationKey, deleteCustomAllocationKey, updateCustomAllocationKey, upsertCustomAllocationKeyWeight } from "@/data/hoa-allocation-keys";
import { requireUser } from "@/lib/auth/dal";
import { ActionState } from "@/lib/action-state";
import { getString, getOptionalFloat } from "@/lib/form-data";

/**
 * CRUD für frei definierbare Verteilerschlüssel (allocationKey "CUSTOM") -
 * je Schlüssel wird für jede Einheit der Liegenschaft ein Gewicht (weight)
 * hinterlegt, das anschließend in src/lib/hoa-allocation.ts wie die übrigen
 * Verteilerschlüssel zur Umlage genutzt wird.
 */

export async function saveCustomAllocationKeyAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	const id = getString(formData, "id");
	const hoaId = getString(formData, "hoaId");
	const label = getString(formData, "label");
	const notes = getString(formData, "notes");

	if (!hoaId || !label) {
		return { error: "Bitte eine Bezeichnung für den Verteilerschlüssel angeben." };
	}

	try {
		if (id) {
			updateCustomAllocationKey(id, { label, notes: notes || null });
		} else {
			createCustomAllocationKey({ hoaId, label, notes: notes || null });
		}
	} catch (error) {
		console.error("saveCustomAllocationKeyAction failed", error);
		return { error: "Der Verteilerschlüssel konnte nicht gespeichert werden." };
	}

	revalidatePath(`/weg/verteilerschluessel`);
	return { success: true };
}

export async function deleteCustomAllocationKeyAction(id: string, _hoaId: string): Promise<ActionState> {
	await requireUser();
	try {
		deleteCustomAllocationKey(id);
	} catch (error) {
		console.error("deleteCustomAllocationKeyAction failed", error);
		return { error: "Löschen fehlgeschlagen. Wird dieser Schlüssel noch von einer Kostenposition verwendet?" };
	}

	revalidatePath(`/weg/verteilerschluessel`);
	return { success: true };
}

export async function saveCustomAllocationWeightsAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	const customAllocationKeyId = getString(formData, "customAllocationKeyId");
	if (!customAllocationKeyId) {
		return { error: "Ungültiger Verteilerschlüssel." };
	}

	const unitIds: string[] = [];
	for (const key of formData.keys()) {
		const match = /^weight-(.+)$/.exec(key);
		if (match) unitIds.push(match[1]);
	}

	// Bewusst sequenzielle Einzel-Upserts (Muster wie bisher, vgl.
	// saveConsumptionValuesAction in src/app/(app)/abrechnung/actions.ts).
	try {
		for (const unitId of unitIds) {
			const weight = getOptionalFloat(formData, `weight-${unitId}`) ?? 0;
			upsertCustomAllocationKeyWeight(customAllocationKeyId, unitId, weight);
		}
	} catch (error) {
		console.error("saveCustomAllocationWeightsAction failed", error);
		return { error: "Die Gewichte konnten nicht gespeichert werden." };
	}

	revalidatePath(`/weg/verteilerschluessel`);
	return { success: true };
}
