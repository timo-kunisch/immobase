"use server";

import { revalidatePath } from "next/cache";

import {
	createLease,
	createRentAdjustment,
	deleteLease,
	deleteRentAdjustment,
	getLease,
	getLeaseWithDetails,
	updateLease,
	updateRentAdjustment,
	type LeaseWithDetails,
} from "@/data/leases";
import { requireUser } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { ActionState } from "@/lib/action-state";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";

function getString(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === "string" ? value.trim() : "";
}

function getDecimalString(formData: FormData, key: string): string | null {
	const raw = getString(formData, key).replace(",", ".");
	if (!raw) return null;
	const parsed = Number(raw);
	return Number.isNaN(parsed) ? null : parsed.toFixed(2);
}

/** Sprechende Bezeichnung eines Mietvertrags für das Aktivitätsprotokoll (Liegenschaft – Einheit / Mieter). */
function describeLease(lease: LeaseWithDetails | null, fallback: string): string {
	if (!lease) return fallback;
	return `${lease.unit.property.name} – ${lease.unit.label} / ${lease.tenant.firstName} ${lease.tenant.lastName}`;
}

export async function saveLeaseAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const id = getString(formData, "id");
	const unitId = getString(formData, "unitId");
	const tenantId = getString(formData, "tenantId");
	const startDateRaw = getString(formData, "startDate");
	const endDateRaw = getString(formData, "endDate");
	const notes = getString(formData, "notes");
	const numberOfOccupantsRaw = getString(formData, "numberOfOccupants");

	const coldRent = getDecimalString(formData, "coldRent");
	const serviceCharges = getDecimalString(formData, "serviceCharges");
	const deposit = getDecimalString(formData, "deposit");

	if (!unitId || !tenantId || !startDateRaw || coldRent === null || serviceCharges === null) {
		return {
			error: t("leases.errors.requiredFields"),
		};
	}

	const numberOfOccupants = Number(numberOfOccupantsRaw);

	const data = {
		unitId,
		tenantId,
		startDate: new Date(startDateRaw).toISOString(),
		endDate: endDateRaw ? new Date(endDateRaw).toISOString() : null,
		coldRent,
		serviceCharges,
		// Grundlage für den Umlageschlüssel "Personen" in der
		// Nebenkostenabrechnung (siehe src/lib/billing.ts), min. 1.
		numberOfOccupants: Number.isInteger(numberOfOccupants) && numberOfOccupants > 0 ? numberOfOccupants : 1,
		deposit,
		notes: notes || null,
	};

	try {
		if (id) {
			updateLease(id, data);
			logActivity(user, "UPDATE", "vertraege", `Mietvertrag „${describeLease(getLeaseWithDetails(id), id)}“ bearbeitet`, id);
		} else {
			const lease = createLease(data);
			logActivity(user, "CREATE", "vertraege", `Mietvertrag „${describeLease(getLeaseWithDetails(lease.id), lease.id)}“ angelegt`, lease.id);
		}
	} catch (error) {
		console.error("saveLeaseAction failed", error);
		return { error: t("leases.errors.saveFailed") };
	}

	revalidatePath("/vertraege");
	revalidatePath("/einheiten");
	revalidatePath("/");
	return { success: true };
}

export async function deleteLeaseAction(id: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	// Bezeichnung vor dem Löschen ermitteln (für den Log-Eintrag).
	const lease = getLeaseWithDetails(id);
	try {
		deleteLease(id);
	} catch (error) {
		console.error("deleteLeaseAction failed", error);
		return { error: t("leases.errors.deleteFailed") };
	}

	logActivity(user, "DELETE", "vertraege", `Mietvertrag „${describeLease(lease, id)}“ gelöscht`, id);

	revalidatePath("/vertraege");
	revalidatePath("/einheiten");
	revalidatePath("/");
	return { success: true };
}

// ============================================================
// Miet-/Nebenkosten-Änderungen (RentAdjustment)
// ============================================================
// Bilden den Verlauf der vereinbarten Zahlungen über die Mietdauer ab
// (z. B. Mieterhöhungen). Der ursprüngliche Betrag steht weiterhin an
// Lease.coldRent/serviceCharges (gültig ab Lease.startDate); jede spätere
// Änderung wird hier als zusätzlicher, ab einem Datum gültiger Eintrag
// erfasst - der alte Wert bleibt dabei erhalten statt überschrieben zu
// werden. Siehe src/lib/rent-history.ts für die Auswertung.

export async function saveRentAdjustmentAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const id = getString(formData, "id");
	const leaseId = getString(formData, "leaseId");
	const validFromRaw = getString(formData, "validFrom");
	const notes = getString(formData, "notes");

	const coldRent = getDecimalString(formData, "coldRent");
	const serviceCharges = getDecimalString(formData, "serviceCharges");

	if (!leaseId || !validFromRaw || coldRent === null || serviceCharges === null) {
		return {
			error: t("leases.errors.adjustmentRequiredFields"),
		};
	}

	const lease = getLease(leaseId);
	if (!lease) {
		return { error: t("leases.errors.leaseNotFound") };
	}

	const validFrom = new Date(validFromRaw);
	if (validFrom <= new Date(lease.startDate)) {
		return {
			error: t("leases.errors.validFromAfterStart"),
		};
	}

	const data = {
		leaseId,
		validFrom: validFrom.toISOString(),
		coldRent,
		serviceCharges,
		notes: notes || null,
	};

	try {
		if (id) {
			updateRentAdjustment(id, data);
			logActivity(user, "UPDATE", "vertraege", `Miet-/Nebenkostenänderung „gültig ab ${formatDate(validFrom)}“ bearbeitet`, id);
		} else {
			const adjustment = createRentAdjustment(data);
			logActivity(user, "CREATE", "vertraege", `Miet-/Nebenkostenänderung „gültig ab ${formatDate(validFrom)}“ angelegt`, adjustment.id);
		}
	} catch (error) {
		console.error("saveRentAdjustmentAction failed", error);
		return {
			error: t("leases.errors.adjustmentSaveFailed"),
		};
	}

	revalidatePath("/vertraege");
	revalidatePath("/finanzen");
	revalidatePath("/");
	return { success: true };
}

export async function deleteRentAdjustmentAction(id: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	try {
		deleteRentAdjustment(id);
	} catch (error) {
		console.error("deleteRentAdjustmentAction failed", error);
		return { error: t("leases.errors.adjustmentDeleteFailed") };
	}

	// Keine getRentAdjustment-Funktion im Repository vorhanden - daher ID-Fallback.
	logActivity(user, "DELETE", "vertraege", `Miet-/Nebenkostenänderung „${id}“ gelöscht`, id);

	revalidatePath("/vertraege");
	revalidatePath("/finanzen");
	revalidatePath("/");
	return { success: true };
}
