"use server";

import { revalidatePath } from "next/cache";

import { createProperty, deleteProperty, getProperty, updateProperty } from "@/data/properties";
import { requireUser } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { ActionState } from "@/lib/action-state";
import { getT } from "@/lib/i18n/server";

function getString(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === "string" ? value.trim() : "";
}

/**
 * Legt eine neue Liegenschaft an oder aktualisiert eine bestehende,
 * je nachdem ob ein verstecktes Feld "id" im Formular vorhanden ist.
 */
export async function savePropertyAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const id = getString(formData, "id");
	const name = getString(formData, "name");
	const street = getString(formData, "street");
	const zipCode = getString(formData, "zipCode");
	const city = getString(formData, "city");
	const country = getString(formData, "country") || "Deutschland";
	const notes = getString(formData, "notes");

	if (!name || !street || !zipCode || !city) {
		return { error: t("properties.errors.requiredFields") };
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
			logActivity(user, "UPDATE", "liegenschaften", `Liegenschaft „${name}“ bearbeitet`, id);
		} else {
			const property = createProperty(data);
			logActivity(user, "CREATE", "liegenschaften", `Liegenschaft „${name}“ angelegt`, property.id);
		}
	} catch (error) {
		console.error("savePropertyAction failed", error);
		return { error: t("properties.errors.saveFailed") };
	}

	revalidatePath("/liegenschaften");
	revalidatePath("/");
	return { success: true };
}

export async function deletePropertyAction(id: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	// Bezeichnung vor dem Löschen ermitteln (für den Log-Eintrag).
	const property = getProperty(id);
	try {
		deleteProperty(id);
	} catch (error) {
		console.error("deletePropertyAction failed", error);
		return {
			error: t("properties.errors.deleteFailed"),
		};
	}

	logActivity(user, "DELETE", "liegenschaften", `Liegenschaft „${property ? property.name : id}“ gelöscht`, id);

	revalidatePath("/liegenschaften");
	revalidatePath("/");
	return { success: true };
}
