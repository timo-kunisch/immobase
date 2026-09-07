"use server";

import { revalidatePath } from "next/cache";

import { createOwner, deleteOwner, updateOwner } from "@/data/owners";
import { requireUser } from "@/lib/auth/dal";
import { ActionState } from "@/lib/action-state";
import { getString } from "@/lib/form-data";

/** Stammdaten-CRUD für Eigentümer (owners) - analog zu src/app/(app)/mieter/actions.ts. */

export async function saveOwnerAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
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
		return { error: "Bitte geben Sie Name und vollständige Anschrift des Eigentümers an." };
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
		} else {
			createOwner(data);
		}
	} catch (error) {
		console.error("saveOwnerAction failed", error);
		return { error: "Der Eigentümer konnte nicht gespeichert werden." };
	}

	revalidatePath("/weg/eigentuemer");
	return { success: true };
}

export async function deleteOwnerAction(id: string): Promise<ActionState> {
	await requireUser();
	try {
		deleteOwner(id);
	} catch (error) {
		console.error("deleteOwnerAction failed", error);
		return {
			error: "Löschen fehlgeschlagen. Bitte entfernen Sie zuerst alle zugehörigen Eigentumsverhältnisse.",
		};
	}

	revalidatePath("/weg/eigentuemer");
	return { success: true };
}
