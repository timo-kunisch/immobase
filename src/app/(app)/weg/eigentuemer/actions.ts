"use server";

import { revalidatePath } from "next/cache";

import { createOwner, deleteOwner, getOwner, updateOwner } from "@/data/owners";
import { requireUser } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { ActionState } from "@/lib/action-state";
import { getString } from "@/lib/form-data";
import { getT } from "@/lib/i18n/server";

/** Stammdaten-CRUD für Eigentümer (owners) - analog zu src/app/(app)/mieter/actions.ts. */

export async function saveOwnerAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const id = getString(formData, "id");
	const firstName = getString(formData, "firstName");
	const lastName = getString(formData, "lastName");
	const isCompany = formData.get("isCompany") === "on";
	const companyName = getString(formData, "companyName");
	const street = getString(formData, "street");
	const zipCode = getString(formData, "zipCode");
	const city = getString(formData, "city");
	const country = getString(formData, "country") || "Deutschland";
	const email = getString(formData, "email");
	const phone = getString(formData, "phone");
	const notes = getString(formData, "notes");

	if (!firstName || !lastName || !street || !zipCode || !city) {
		return { error: t("hoa.owners.errors.requiredFields") };
	}

	const data = {
		firstName,
		lastName,
		isCompany,
		companyName: isCompany ? companyName || null : null,
		street,
		zipCode,
		city,
		country,
		email: email || null,
		phone: phone || null,
		notes: notes || null,
	};

	try {
		if (id) {
			updateOwner(id, data);
			logActivity(user, "UPDATE", "eigentuemer", `Eigentümer „${firstName} ${lastName}“ bearbeitet`, id);
		} else {
			const owner = createOwner(data);
			logActivity(user, "CREATE", "eigentuemer", `Eigentümer „${firstName} ${lastName}“ angelegt`, owner.id);
		}
	} catch (error) {
		console.error("saveOwnerAction failed", error);
		return { error: t("hoa.owners.errors.saveFailed") };
	}

	revalidatePath("/weg/eigentuemer");
	return { success: true };
}

export async function deleteOwnerAction(id: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	// Bezeichnung vor dem Löschen ermitteln (für den Log-Eintrag).
	const owner = getOwner(id);
	try {
		deleteOwner(id);
	} catch (error) {
		console.error("deleteOwnerAction failed", error);
		return {
			error: t("hoa.owners.errors.deleteFailed"),
		};
	}

	logActivity(user, "DELETE", "eigentuemer", `Eigentümer „${owner ? `${owner.firstName} ${owner.lastName}` : id}“ gelöscht`, id);

	revalidatePath("/weg/eigentuemer");
	return { success: true };
}
