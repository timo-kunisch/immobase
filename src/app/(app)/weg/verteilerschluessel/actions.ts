"use server";

import { revalidatePath } from "next/cache";

import { createCustomAllocationKey, deleteCustomAllocationKey, listCustomAllocationKeysWithWeights, updateCustomAllocationKey, upsertCustomAllocationKeyWeight } from "@/data/hoa-allocation-keys";
import { requireUser } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { ActionState } from "@/lib/action-state";
import { getString, getOptionalFloat } from "@/lib/form-data";

/**
 * CRUD für frei definierbare Verteilerschlüssel (allocationKey "CUSTOM") -
 * je Schlüssel wird für jede Einheit der Liegenschaft ein Gewicht (weight)
 * hinterlegt, das anschließend in src/lib/hoa-allocation.ts wie die übrigen
 * Verteilerschlüssel zur Umlage genutzt wird.
 */

export async function saveCustomAllocationKeyAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
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
			logActivity(user, "UPDATE", "verteilerschluessel", `Verteilerschlüssel „${label}“ bearbeitet`, id);
		} else {
			const allocationKey = createCustomAllocationKey({ hoaId, label, notes: notes || null });
			logActivity(user, "CREATE", "verteilerschluessel", `Verteilerschlüssel „${label}“ angelegt`, allocationKey.id);
		}
	} catch (error) {
		console.error("saveCustomAllocationKeyAction failed", error);
		return { error: "Der Verteilerschlüssel konnte nicht gespeichert werden." };
	}

	revalidatePath(`/weg/verteilerschluessel`);
	return { success: true };
}

export async function deleteCustomAllocationKeyAction(id: string, hoaId: string): Promise<ActionState> {
	const user = await requireUser();
	// Bezeichnung vor dem Löschen ermitteln (für den Log-Eintrag).
	const allocationKey = listCustomAllocationKeysWithWeights(hoaId).find((key) => key.id === id) ?? null;
	try {
		deleteCustomAllocationKey(id);
	} catch (error) {
		console.error("deleteCustomAllocationKeyAction failed", error);
		return { error: "Löschen fehlgeschlagen. Wird dieser Schlüssel noch von einer Kostenposition verwendet?" };
	}

	logActivity(user, "DELETE", "verteilerschluessel", `Verteilerschlüssel „${allocationKey ? allocationKey.label : id}“ gelöscht`, id);

	revalidatePath(`/weg/verteilerschluessel`);
	return { success: true };
}

export async function saveCustomAllocationWeightsAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
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
		logActivity(user, "UPDATE", "verteilerschluessel", `Gewichte des Verteilerschlüssels „${customAllocationKeyId}“ aktualisiert`, customAllocationKeyId);
	} catch (error) {
		console.error("saveCustomAllocationWeightsAction failed", error);
		return { error: "Die Gewichte konnten nicht gespeichert werden." };
	}

	revalidatePath(`/weg/verteilerschluessel`);
	return { success: true };
}
