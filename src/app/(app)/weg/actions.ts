"use server";

import { revalidatePath } from "next/cache";

import { createHoa, deleteHoa, updateHoa } from "@/data/hoas";
import { requireUser } from "@/lib/auth/dal";
import { ActionState } from "@/lib/action-state";
import { getString, getOptionalFloat } from "@/lib/form-data";

/**
 * Stammdaten-CRUD für WEGs (hoas) - eine WEG ist immer 1:1 an eine
 * bestehende Liegenschaft gebunden (hoas.property_id). Analog zu
 * src/app/(app)/liegenschaften/actions.ts.
 */

export async function saveHoaAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	const id = getString(formData, "id");
	const propertyId = getString(formData, "propertyId");
	const name = getString(formData, "name");
	const totalShares = getOptionalFloat(formData, "totalShares");
	const bankIban = getString(formData, "bankIban");
	const bankBic = getString(formData, "bankBic");
	const notes = getString(formData, "notes");

	if (!propertyId || !name || totalShares === null || totalShares <= 0) {
		return { error: "Bitte Liegenschaft, Bezeichnung und eine gültige Gesamtsumme der Miteigentumsanteile angeben." };
	}

	const data = {
		propertyId,
		name,
		totalShares,
		bankIban: bankIban || null,
		bankBic: bankBic || null,
		notes: notes || null,
	};

	try {
		if (id) {
			updateHoa(id, data);
		} else {
			createHoa(data);
		}
	} catch (error) {
		console.error("saveHoaAction failed", error);
		return { error: "Die WEG konnte nicht gespeichert werden. Ist die Liegenschaft bereits einer anderen WEG zugeordnet?" };
	}

	revalidatePath("/weg");
	return { success: true };
}

export async function deleteHoaAction(id: string): Promise<ActionState> {
	await requireUser();
	try {
		deleteHoa(id);
	} catch (error) {
		console.error("deleteHoaAction failed", error);
		return {
			error: "Löschen fehlgeschlagen. Bitte entfernen Sie zuerst alle zugehörigen Wirtschaftspläne/Jahresabrechnungen/Versammlungen.",
		};
	}

	revalidatePath("/weg");
	return { success: true };
}
