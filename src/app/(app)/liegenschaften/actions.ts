"use server";

import { revalidatePath } from "next/cache";

import { createProperty, deleteProperty, updateProperty } from "@/data/properties";
import { requireUser } from "@/lib/auth/dal";
import { ActionState } from "@/lib/action-state";

function getString(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === "string" ? value.trim() : "";
}

/**
 * Legt eine neue Liegenschaft an oder aktualisiert eine bestehende,
 * je nachdem ob ein verstecktes Feld "id" im Formular vorhanden ist.
 */
export async function savePropertyAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	const id = getString(formData, "id");
	const name = getString(formData, "name");
	const street = getString(formData, "street");
	const zipCode = getString(formData, "zipCode");
	const city = getString(formData, "city");
	const country = getString(formData, "country") || "Deutschland";
	const notes = getString(formData, "notes");

	if (!name || !street || !zipCode || !city) {
		return { error: "Bitte füllen Sie alle Pflichtfelder aus." };
	}

	const data = {
		name,
		street,
		zipCode,
		city,
		country,
		notes: notes || null,
	};

	try {
		if (id) {
			updateProperty(id, data);
		} else {
			createProperty(data);
		}
	} catch (error) {
		console.error("savePropertyAction failed", error);
		return { error: "Die Liegenschaft konnte nicht gespeichert werden." };
	}

	revalidatePath("/liegenschaften");
	revalidatePath("/");
	return { success: true };
}

export async function deletePropertyAction(id: string): Promise<ActionState> {
	await requireUser();
	try {
		deleteProperty(id);
	} catch (error) {
		console.error("deletePropertyAction failed", error);
		return {
			error: "Löschen fehlgeschlagen. Bitte entfernen Sie zuerst alle zugehörigen Einheiten.",
		};
	}

	revalidatePath("/liegenschaften");
	revalidatePath("/");
	return { success: true };
}
