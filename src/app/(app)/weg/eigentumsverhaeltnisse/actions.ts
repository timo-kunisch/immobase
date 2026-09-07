"use server";

import { revalidatePath } from "next/cache";

import { createUnitOwnership, deleteUnitOwnership, getOpenUnitOwnership, setUnitOwnershipEndDate, updateUnitOwnership } from "@/data/unit-ownerships";
import { requireUser } from "@/lib/auth/dal";
import { ActionState } from "@/lib/action-state";
import { getString } from "@/lib/form-data";

/**
 * CRUD für Eigentumsverhältnisse (unit_ownerships) - zeitversioniert, um
 * unterjährige Eigentümerwechsel abzubilden (siehe src/lib/hoa-ownership.ts).
 * Ein neuer Eigentümer wird nicht durch Überschreiben des bisherigen
 * Datensatzes erfasst, sondern als NEUE Zeile mit eigenem startDate - die
 * vorherige Zeile erhält beim Anlegen automatisch ein endDate (Tag vor dem
 * neuen startDate), analog zum Muster von rent_adjustments in der
 * Mietverwaltung (dort bleibt der alte Wert ebenfalls erhalten statt
 * überschrieben zu werden).
 */

export async function saveUnitOwnershipAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	const id = getString(formData, "id");
	const unitId = getString(formData, "unitId");
	const ownerId = getString(formData, "ownerId");
	const coOwnerIdRaw = getString(formData, "coOwnerId");
	const coOwnerId = coOwnerIdRaw === "none" ? "" : coOwnerIdRaw;
	const startDateRaw = getString(formData, "startDate");
	const notes = getString(formData, "notes");

	if (!unitId || !ownerId || !startDateRaw) {
		return { error: "Bitte Einheit, Eigentümer und Beginn-Datum angeben." };
	}
	if (coOwnerId === ownerId) {
		return { error: "Eigentümer und Miteigentümer dürfen nicht identisch sein." };
	}

	const startDate = new Date(startDateRaw);

	const data = {
		unitId,
		ownerId,
		coOwnerId: coOwnerId || null,
		startDate: startDate.toISOString(),
		notes: notes || null,
	};

	try {
		if (id) {
			updateUnitOwnership(id, data);
		} else {
			// Beim Anlegen eines neuen Eigentumsverhältnisses (Eigentümerwechsel):
			// das bisher noch laufende Eigentumsverhältnis derselben Einheit
			// (endDate = null) automatisch am Vortag des neuen Beginns beenden -
			// verhindert eine sich überlappende Doppelzuordnung derselben
			// Einheit ohne dass der Nutzer das Enddatum der alten Zeile separat
			// pflegen muss.
			const previousOpenOwnership = getOpenUnitOwnership(unitId);
			if (previousOpenOwnership) {
				if (new Date(previousOpenOwnership.startDate) >= startDate) {
					return { error: "Das Beginn-Datum muss nach dem Beginn des aktuell laufenden Eigentumsverhältnisses dieser Einheit liegen." };
				}
				const endDate = new Date(startDate);
				endDate.setDate(endDate.getDate() - 1);
				setUnitOwnershipEndDate(previousOpenOwnership.id, endDate.toISOString());
			}

			createUnitOwnership(data);
		}
	} catch (error) {
		console.error("saveUnitOwnershipAction failed", error);
		return { error: "Das Eigentumsverhältnis konnte nicht gespeichert werden." };
	}

	revalidatePath(`/weg/eigentumsverhaeltnisse`);
	return { success: true };
}

export async function deleteUnitOwnershipAction(id: string): Promise<ActionState> {
	await requireUser();
	try {
		deleteUnitOwnership(id);
	} catch (error) {
		console.error("deleteUnitOwnershipAction failed", error);
		return { error: "Das Eigentumsverhältnis konnte nicht gelöscht werden." };
	}

	revalidatePath(`/weg/eigentumsverhaeltnisse`);
	return { success: true };
}
