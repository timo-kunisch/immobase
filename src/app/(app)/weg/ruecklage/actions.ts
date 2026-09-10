"use server";

import { revalidatePath } from "next/cache";

import { createReserveFundBooking, deleteReserveFundBooking, updateReserveFundBooking } from "@/data/reserve-fund";
import { requireUser } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { getT } from "@/lib/i18n/server";
import { ActionState } from "@/lib/action-state";
import { getString, getDecimalString } from "@/lib/form-data";
import type { ReserveFundBookingType } from "@/data/types";

const RESERVE_FUND_BOOKING_TYPES: ReserveFundBookingType[] = ["CONTRIBUTION", "WITHDRAWAL"];

export async function saveReserveFundBookingAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const id = getString(formData, "id");
	const hoaId = getString(formData, "hoaId");
	const bookingDateRaw = getString(formData, "bookingDate");
	const typeRaw = getString(formData, "type") as ReserveFundBookingType;
	const amount = getDecimalString(formData, "amount");
	const description = getString(formData, "description");
	const notes = getString(formData, "notes");

	if (!hoaId || !bookingDateRaw || amount === null || !description) {
		return { error: t("hoaFinance.reserve.errors.requiredFields") };
	}
	if (!RESERVE_FUND_BOOKING_TYPES.includes(typeRaw)) {
		return { error: t("hoaFinance.reserve.errors.invalidType") };
	}
	if (Number(amount) <= 0) {
		return { error: t("hoaFinance.reserve.errors.amountPositive") };
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
			logActivity(user, "UPDATE", "ruecklage", `Rücklagenbuchung „${description}“ bearbeitet`, id);
		} else {
			const booking = createReserveFundBooking(data);
			logActivity(user, "CREATE", "ruecklage", `Rücklagenbuchung „${description}“ angelegt`, booking.id);
		}
	} catch (error) {
		console.error("saveReserveFundBookingAction failed", error);
		return { error: t("hoaFinance.reserve.errors.saveFailed") };
	}

	revalidatePath(`/weg/ruecklage`);
	return { success: true };
}

export async function deleteReserveFundBookingAction(id: string, _hoaId: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	try {
		deleteReserveFundBooking(id);
	} catch (error) {
		console.error("deleteReserveFundBookingAction failed", error);
		return { error: t("hoaFinance.reserve.errors.deleteFailed") };
	}

	// Es gibt keine getX-Funktion für eine einzelne Buchung - Fallback auf die ID.
	logActivity(user, "DELETE", "ruecklage", `Rücklagenbuchung „${id}“ gelöscht`, id);

	revalidatePath(`/weg/ruecklage`);
	return { success: true };
}
