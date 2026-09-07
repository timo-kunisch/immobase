"use server";

import { revalidatePath } from "next/cache";

import { createReserveFundBooking, deleteReserveFundBooking, updateReserveFundBooking } from "@/data/reserve-fund";
import { requireUser } from "@/lib/auth/dal";
import { ActionState } from "@/lib/action-state";
import { getString, getDecimalString } from "@/lib/form-data";
import type { ReserveFundBookingType } from "@/data/types";

const RESERVE_FUND_BOOKING_TYPES: ReserveFundBookingType[] = ["CONTRIBUTION", "WITHDRAWAL"];

export async function saveReserveFundBookingAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	const id = getString(formData, "id");
	const hoaId = getString(formData, "hoaId");
	const bookingDateRaw = getString(formData, "bookingDate");
	const typeRaw = getString(formData, "type") as ReserveFundBookingType;
	const amount = getDecimalString(formData, "amount");
	const description = getString(formData, "description");
	const notes = getString(formData, "notes");

	if (!hoaId || !bookingDateRaw || amount === null || !description) {
		return { error: "Bitte Datum, Betrag und Bezeichnung der Buchung angeben." };
	}
	if (!RESERVE_FUND_BOOKING_TYPES.includes(typeRaw)) {
		return { error: "Ungültige Buchungsart." };
	}
	if (Number(amount) <= 0) {
		return { error: "Der Betrag muss größer als 0 sein (die Buchungsart bestimmt das Vorzeichen)." };
	}

	const data = {
		hoaId,
		bookingDate: new Date(bookingDateRaw).toISOString(),
		type: typeRaw,
		amount,
		description,
		notes: notes || null,
	};

	try {
		if (id) {
			updateReserveFundBooking(id, data);
		} else {
			createReserveFundBooking(data);
		}
	} catch (error) {
		console.error("saveReserveFundBookingAction failed", error);
		return { error: "Die Buchung konnte nicht gespeichert werden." };
	}

	revalidatePath(`/weg/ruecklage`);
	return { success: true };
}

export async function deleteReserveFundBookingAction(id: string, _hoaId: string): Promise<ActionState> {
	await requireUser();
	try {
		deleteReserveFundBooking(id);
	} catch (error) {
		console.error("deleteReserveFundBookingAction failed", error);
		return { error: "Die Buchung konnte nicht gelöscht werden." };
	}

	revalidatePath(`/weg/ruecklage`);
	return { success: true };
}
