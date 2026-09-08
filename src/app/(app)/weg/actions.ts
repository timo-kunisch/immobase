"use server";

import { revalidatePath } from "next/cache";

import { createHoa, deleteHoa, updateHoa } from "@/data/hoas";
import { getHoa } from "@/data/reserve-fund";
import { requireUser } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { ActionState } from "@/lib/action-state";
import { getString, getOptionalFloat } from "@/lib/form-data";

/**
 * Stammdaten-CRUD für WEGs (hoas) - eine WEG ist immer 1:1 an eine
 * bestehende Liegenschaft gebunden (hoas.property_id). Analog zu
 * src/app/(app)/liegenschaften/actions.ts.
 */

export async function saveHoaAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
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
			logActivity(user, "UPDATE", "weg", `WEG „${name}“ bearbeitet`, id);
		} else {
			const hoa = createHoa(data);
			logActivity(user, "CREATE", "weg", `WEG „${name}“ angelegt`, hoa.id);
		}
	} catch (error) {
		console.error("saveHoaAction failed", error);
		return { error: "Die WEG konnte nicht gespeichert werden. Ist die Liegenschaft bereits einer anderen WEG zugeordnet?" };
	}

	revalidatePath("/weg");
	return { success: true };
}

export async function deleteHoaAction(id: string): Promise<ActionState> {
	const user = await requireUser();
	// Bezeichnung vor dem Löschen ermitteln (für den Log-Eintrag).
	const hoa = getHoa(id);
	try {
		deleteHoa(id);
	} catch (error) {
		console.error("deleteHoaAction failed", error);
		return {
			error: "Löschen fehlgeschlagen. Bitte entfernen Sie zuerst alle zugehörigen Wirtschaftspläne/Jahresabrechnungen/Versammlungen.",
		};
	}

	logActivity(user, "DELETE", "weg", `WEG „${hoa ? hoa.name : id}“ gelöscht`, id);

	revalidatePath("/weg");
	return { success: true };
}
