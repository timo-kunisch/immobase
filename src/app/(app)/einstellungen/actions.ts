"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/dal";
import { saveCompanySettings } from "@/data/company-settings";
import { setSetting } from "@/data/app-settings";
import { ActionState } from "@/lib/action-state";

function getString(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === "string" ? value.trim() : "";
}

/**
 * Speichert die Absenderdaten (Vermieter/Hausverwaltung), die auf erzeugten
 * PDFs (aktuell: Nebenkostenabrechnungen) als Briefkopf erscheinen. Nur für
 * Admins zugänglich - requireAdmin() leitet andernfalls um/wirft.
 */
export async function saveCompanySettingsAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	await requireAdmin();

	const name = getString(formData, "name");
	const street = getString(formData, "street");
	const zipCode = getString(formData, "zipCode");
	const city = getString(formData, "city");
	const additional = getString(formData, "additional");

	try {
		saveCompanySettings({
			name,
			street,
			zipCode,
			city,
			additional: additional || null,
		});
	} catch (error) {
		console.error("saveCompanySettingsAction failed", error);
		return { error: "Die Einstellungen konnten nicht gespeichert werden." };
	}

	revalidatePath("/einstellungen");
	return { success: true };
}

/**
 * Speichert die Integrations-Einstellungen (SMTP für E-Mail-Versand,
 * LetterXpress für Postversand) in der app_settings-Tabelle. Leere
 * Geheimnis-Felder (Passwort/API-Key) bleiben unverändert - so muss die UI
 * vorhandene Werte nicht anzeigen. Nur für Admins.
 */
export async function saveIntegrationSettingsAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	await requireAdmin();

	try {
		// SMTP (leere Host-Adresse = deaktiviert -> Outbox-Log-Fallback)
		setSetting("smtp.host", getString(formData, "smtpHost"));
		setSetting("smtp.port", getString(formData, "smtpPort"));
		setSetting("smtp.secure", formData.get("smtpSecure") === "on" ? "true" : "false");
		setSetting("smtp.user", getString(formData, "smtpUser"));
		const smtpPass = getString(formData, "smtpPass");
		if (smtpPass) setSetting("smtp.pass", smtpPass);
		setSetting("smtp.from", getString(formData, "smtpFrom"));

		// LetterXpress (Postversand - optionale Online-Funktion)
		setSetting("letterxpress.username", getString(formData, "lxUsername"));
		const lxApiKey = getString(formData, "lxApiKey");
		if (lxApiKey) setSetting("letterxpress.apikey", lxApiKey);
		setSetting("letterxpress.mode", getString(formData, "lxMode") === "live" ? "live" : "test");
	} catch (error) {
		console.error("saveIntegrationSettingsAction failed", error);
		return { error: "Die Einstellungen konnten nicht gespeichert werden." };
	}

	revalidatePath("/einstellungen");
	return { success: true };
}
