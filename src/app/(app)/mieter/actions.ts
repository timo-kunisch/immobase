"use server";

import { revalidatePath } from "next/cache";

import { createTenant, deleteTenant, getTenant, updateTenant } from "@/data/tenants";
import { requireUser } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { ActionState } from "@/lib/action-state";

function getString(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === "string" ? value.trim() : "";
}

export async function saveTenantAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
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
			logActivity(user, "UPDATE", "mieter", `Mieter „${firstName} ${lastName}“ bearbeitet`, id);
		} else {
			const tenant = createTenant(data);
			logActivity(user, "CREATE", "mieter", `Mieter „${firstName} ${lastName}“ angelegt`, tenant.id);
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
	const user = await requireUser();
	// Bezeichnung vor dem Löschen ermitteln (für den Log-Eintrag).
	const tenant = getTenant(id);
	try {
		deleteTenant(id);
	} catch (error) {
		console.error("deleteTenantAction failed", error);
		return {
			error: "Löschen fehlgeschlagen. Bitte entfernen Sie zuerst alle zugehörigen Mietverträge.",
		};
	}

	logActivity(user, "DELETE", "mieter", `Mieter „${tenant ? `${tenant.firstName} ${tenant.lastName}` : id}“ gelöscht`, id);

	revalidatePath("/mieter");
	revalidatePath("/");
	return { success: true };
}
