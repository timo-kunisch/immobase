import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SetupWizard } from "@/components/setup/setup-wizard";
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

	return <SetupWizard company={company} />;
}
