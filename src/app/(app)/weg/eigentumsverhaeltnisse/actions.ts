"use server";

import { revalidatePath } from "next/cache";

import { getOwner } from "@/data/owners";
import { createUnitOwnership, deleteUnitOwnership, getOpenUnitOwnership, setUnitOwnershipEndDate, updateUnitOwnership } from "@/data/unit-ownerships";
import { getUnit } from "@/data/units";
import { requireUser } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { ActionState } from "@/lib/action-state";
import { getString } from "@/lib/form-data";
import { getT } from "@/lib/i18n/server";

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
	const user = await requireUser();
	const t = await getT();
	const id = getString(formData, "id");
	const unitId = getString(formData, "unitId");
	const ownerId = getString(formData, "ownerId");
	const coOwnerIdRaw = getString(formData, "coOwnerId");
	const coOwnerId = coOwnerIdRaw === "none" ? "" : coOwnerIdRaw;
	const startDateRaw = getString(formData, "startDate");
	const notes = getString(formData, "notes");

	if (!unitId || !ownerId || !startDateRaw) {
		return { error: t("hoa.ownerships.errors.requiredFields") };
	}
	if (coOwnerId === ownerId) {
		return { error: t("hoa.ownerships.errors.coOwnerSame") };
	}

	const startDate = new Date(startDateRaw);

	const data = {
		unitId,
		ownerId,
		coOwnerId: coOwnerId || null,
		startDate: startDate.toISOString(),
		notes: notes || null,
	};

	// Bezeichnungen von Einheit und Eigentümer für den Log-Eintrag auflösen.
	const unit = getUnit(unitId);
	const owner = getOwner(ownerId);
	const ownershipLabel = `${unit ? unit.label : unitId} / ${owner ? `${owner.firstName} ${owner.lastName}` : ownerId}`;

	try {
		if (id) {
			updateUnitOwnership(id, data);
			logActivity(user, "UPDATE", "eigentumsverhaeltnisse", `Eigentumsverhältnis „${ownershipLabel}“ bearbeitet`, id);
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
					return { error: t("hoa.ownerships.errors.startDateNotAfterCurrent") };
				}
				const endDate = new Date(startDate);
				endDate.setDate(endDate.getDate() - 1);
				setUnitOwnershipEndDate(previousOpenOwnership.id, endDate.toISOString());
			}

			const ownership = createUnitOwnership(data);
			logActivity(user, "CREATE", "eigentumsverhaeltnisse", `Eigentumsverhältnis „${ownershipLabel}“ angelegt`, ownership.id);
		}
	} catch (error) {
		console.error("saveUnitOwnershipAction failed", error);
		return { error: t("hoa.ownerships.errors.saveFailed") };
	}

	revalidatePath(`/weg/eigentumsverhaeltnisse`);
	return { success: true };
}

export async function deleteUnitOwnershipAction(id: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	try {
		deleteUnitOwnership(id);
	} catch (error) {
		console.error("deleteUnitOwnershipAction failed", error);
		return { error: t("hoa.ownerships.errors.deleteFailed") };
	}

	// Es gibt keine getX-Funktion für eine einzelne Zeile - Fallback auf die ID.
	logActivity(user, "DELETE", "eigentumsverhaeltnisse", `Eigentumsverhältnis „${id}“ gelöscht`, id);

	revalidatePath(`/weg/eigentumsverhaeltnisse`);
	return { success: true };
}
