"use server";

import { revalidatePath } from "next/cache";

import {
	createLease,
	createRentAdjustment,
	deleteLease,
	deleteRentAdjustment,
	getLease,
	updateLease,
	updateRentAdjustment,
} from "@/data/leases";
import { requireUser } from "@/lib/auth/dal";
import { ActionState } from "@/lib/action-state";

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

export async function saveLeaseAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
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
			error: "Bitte wählen Sie Einheit & Mieter aus und geben Sie Mietbeginn, Kaltmiete sowie Nebenkosten an.",
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
		} else {
			createLease(data);
		}
	} catch (error) {
		console.error("saveLeaseAction failed", error);
		return { error: "Der Mietvertrag konnte nicht gespeichert werden." };
	}

	revalidatePath("/vertraege");
	revalidatePath("/einheiten");
	revalidatePath("/");
	return { success: true };
}

export async function deleteLeaseAction(id: string): Promise<ActionState> {
	await requireUser();
	try {
		deleteLease(id);
	} catch (error) {
		console.error("deleteLeaseAction failed", error);
		return { error: "Der Mietvertrag konnte nicht gelöscht werden." };
	}

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
	await requireUser();
	const id = getString(formData, "id");
	const leaseId = getString(formData, "leaseId");
	const validFromRaw = getString(formData, "validFrom");
	const notes = getString(formData, "notes");

	const coldRent = getDecimalString(formData, "coldRent");
	const serviceCharges = getDecimalString(formData, "serviceCharges");

	if (!leaseId || !validFromRaw || coldRent === null || serviceCharges === null) {
		return {
			error: "Bitte geben Sie Gültigkeitsdatum, Kaltmiete sowie Nebenkosten an.",
		};
	}

	const lease = getLease(leaseId);
	if (!lease) {
		return { error: "Der zugehörige Mietvertrag wurde nicht gefunden." };
	}

	const validFrom = new Date(validFromRaw);
	if (validFrom <= new Date(lease.startDate)) {
		return {
			error: "Das Gültigkeitsdatum muss nach dem Mietbeginn liegen (der Betrag zum Mietbeginn wird direkt im Vertrag gepflegt).",
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
		} else {
			createRentAdjustment(data);
		}
	} catch (error) {
		console.error("saveRentAdjustmentAction failed", error);
		return {
			error: "Die Änderung konnte nicht gespeichert werden. Existiert für dieses Datum bereits ein Eintrag?",
		};
	}

	revalidatePath("/vertraege");
	revalidatePath("/finanzen");
	revalidatePath("/");
	return { success: true };
}

export async function deleteRentAdjustmentAction(id: string): Promise<ActionState> {
	await requireUser();
	try {
		deleteRentAdjustment(id);
	} catch (error) {
		console.error("deleteRentAdjustmentAction failed", error);
		return { error: "Die Änderung konnte nicht gelöscht werden." };
	}

	revalidatePath("/vertraege");
	revalidatePath("/finanzen");
	revalidatePath("/");
	return { success: true };
}
