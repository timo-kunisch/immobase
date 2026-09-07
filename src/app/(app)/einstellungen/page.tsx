import { SiteHeader } from "@/components/layout/site-header";
import { CompanySettingsForm } from "@/components/einstellungen/company-settings-form";
import { ConnectionCard } from "@/components/einstellungen/connection-card";
import { DataExportCard } from "@/components/einstellungen/data-export-card";
import { IntegrationSettingsForm } from "@/components/einstellungen/integration-settings-form";
import { getCompanySettings } from "@/data/company-settings";
import { getSetting } from "@/data/app-settings";

export const dynamic = "force-dynamic";

export default async function EinstellungenPage() {
	const settings = getCompanySettings();
	// Gespeicherte Geheimnisse werden NICHT an den Client gegeben - nur die
	// Information, ob sie gesetzt sind (Platzhalter im Formular).
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

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader
				title="Einstellungen"
				description="Absenderdaten für erzeugte PDFs, Datensicherung, Online-Integrationen und Verbindung (Mehrbenutzer-Betrieb)."
			/>

			<div className="flex-1 space-y-6 p-4 sm:p-6">
				<CompanySettingsForm settings={settings} />
				<DataExportCard />
				<IntegrationSettingsForm settings={integrations} />
				<ConnectionCard />
			</div>
		</div>
	);
}
