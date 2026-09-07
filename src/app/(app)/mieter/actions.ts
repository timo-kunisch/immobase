"use server";

import { revalidatePath } from "next/cache";

import { createTenant, deleteTenant, updateTenant } from "@/data/tenants";
import { requireUser } from "@/lib/auth/dal";
import { ActionState } from "@/lib/action-state";

function getString(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === "string" ? value.trim() : "";
}

export async function saveTenantAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	const id = getString(formData, "id");
	const firstName = getString(formData, "firstName");
	const lastName = getString(formData, "lastName");
	const email = getString(formData, "email");
	const phone = getString(formData, "phone");
	const notes = getString(formData, "notes");

	if (!firstName || !lastName) {
		return { error: "Bitte geben Sie Vor- und Nachnamen an." };
	}

	const data = {
		firstName,
		lastName,
		email: email || null,
		phone: phone || null,
		notes: notes || null,
	};

	try {
		if (id) {
			updateTenant(id, data);
		} else {
			createTenant(data);
		}
	} catch (error) {
		console.error("saveTenantAction failed", error);
		return { error: "Der Mieter konnte nicht gespeichert werden." };
	}

	revalidatePath("/mieter");
	revalidatePath("/");
	return { success: true };
}

export async function deleteTenantAction(id: string): Promise<ActionState> {
	await requireUser();
	try {
		deleteTenant(id);
	} catch (error) {
		console.error("deleteTenantAction failed", error);
		return {
			error: "Löschen fehlgeschlagen. Bitte entfernen Sie zuerst alle zugehörigen Mietverträge.",
		};
	}

	revalidatePath("/mieter");
	revalidatePath("/");
	return { success: true };
}
