import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SetupWizard } from "@/components/setup/setup-wizard";
import { getSetting } from "@/data/app-settings";
import { getCompanySettings } from "@/data/company-settings";
import { countUsers } from "@/data/users";

export const metadata: Metadata = {
	title: "Ersteinrichtung – ImmoBase",
};

// DB-Zugriff (countUsers) – niemals statisch prerendern.
export const dynamic = "force-dynamic";

/**
 * Ersteinrichtung (Setup-Wizard) beim allerersten Start: führt durch die
 * Grundeinstellungen der App und legt das Administratorkonto an.
 *
 * Die Seite ist nur erreichbar, solange noch KEIN Benutzerkonto existiert
 * (Login-/Register-Seite leiten in diesem Fall hierher um, siehe dort).
 * Sobald ein Konto existiert, gilt der normale Login – die Einstellungen
 * sind danach ausschließlich über /einstellungen (Admin) änderbar.
 */
export default function SetupPage() {
	if (countUsers() > 0) {
		redirect("/login");
	}

	const company = getCompanySettings();
	// Gespeicherte Geheimnisse werden NICHT an den Client gegeben – nur die
	// Information, ob sie gesetzt sind (Platzhalter im Formular), wie in
	// /einstellungen. Relevant, wenn die Einrichtung nach einem Abbruch
	// erneut durchlaufen wird.
	const integrations = {
		smtpHost: getSetting("smtp.host") ?? "",
		smtpPort: getSetting("smtp.port") ?? "",
		smtpSecure: getSetting("smtp.secure") === "true",
		smtpUser: getSetting("smtp.user") ?? "",
		smtpPassSet: Boolean(getSetting("smtp.pass")),
		smtpFrom: getSetting("smtp.from") ?? "",
		lxUsername: getSetting("letterxpress.username") ?? "",
		lxApiKeySet: Boolean(getSetting("letterxpress.apikey")),
		lxMode: (getSetting("letterxpress.mode") === "live" ? "live" : "test") as "test" | "live",
	};

	return <SetupWizard company={company} integrations={integrations} />;
}
