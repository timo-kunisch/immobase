import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { CompanySettingsForm } from "@/components/einstellungen/company-settings-form";
import { ConnectionCard } from "@/components/einstellungen/connection-card";
import { DataExportCard } from "@/components/einstellungen/data-export-card";
import { DropboxBackupCard } from "@/components/einstellungen/dropbox-backup-card";
import { IntegrationSettingsForm } from "@/components/einstellungen/integration-settings-form";
import { ResetAppCard } from "@/components/einstellungen/reset-app-card";
import { SecurityCard, type SecurityStatus } from "@/components/einstellungen/security-card";
import { getCompanySettings } from "@/data/company-settings";
import { getSecretSettingsStatus, getSetting } from "@/data/app-settings";
import { getDatabaseFilePath } from "@/data/paths";
import { getDataKeySource } from "@/lib/data-key";
import { getDropboxUiState } from "@/lib/dropbox-backup";
import { getTreeEncryptionStatus } from "@/lib/file-crypto";
import fs from "node:fs";

export const dynamic = "force-dynamic";

// Sprungziele für die Bereichs-Navigation oben auf der Seite (Anchor-Links auf
// die <section id="...">-Wrapper der einzelnen Einstellungs-Karten).
const settingsSections = [
	{ id: "absenderdaten", label: "Absenderdaten" },
	{ id: "datensicherung", label: "Datensicherung" },
	{ id: "dropbox-backup", label: "Dropbox-Backup" },
	{ id: "datenverschluesselung", label: "Lokale Datenverschlüsselung" },
	{ id: "online-integrationen", label: "Online-Integrationen" },
	{ id: "verbindung", label: "Verbindung & Mehrbenutzer" },
	{ id: "zuruecksetzen", label: "Anwendung zurücksetzen" },
];

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

	// Status der lokalen Datenverschlüsselung at rest (Dateien + Geheimnisse +
	// Datenbank-Container, siehe src/data/db-vault.ts).
	const fileStatus = getTreeEncryptionStatus();
	const secretStatus = getSecretSettingsStatus();
	const dbPath = getDatabaseFilePath();
	const securityStatus: SecurityStatus = {
		keySource: getDataKeySource(),
		filesTotal: fileStatus.total,
		filesEncrypted: fileStatus.encrypted,
		filesPlaintext: fileStatus.plaintext,
		secretsSet: secretStatus.secretsSet,
		secretsEncrypted: secretStatus.secretsEncrypted,
		databaseEncrypted: fs.existsSync(`${dbPath}.enc`),
	};

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader
				title="Einstellungen"
				description="Absenderdaten für erzeugte PDFs, Datensicherung, Online-Integrationen und Verbindung (Mehrbenutzer-Betrieb)."
			/>

			<div className="flex-1 space-y-6 p-4 sm:p-6">
				<nav aria-label="Einstellungsbereiche" className="flex flex-wrap gap-2">
					{settingsSections.map((section) => (
						<Button key={section.id} variant="outline" size="sm" asChild>
							<a href={`#${section.id}`}>{section.label}</a>
						</Button>
					))}
				</nav>

				<section id="absenderdaten" className="scroll-mt-6">
					<CompanySettingsForm settings={settings} />
				</section>
				<section id="datensicherung" className="scroll-mt-6">
					<DataExportCard />
				</section>
				<section id="dropbox-backup" className="scroll-mt-6">
					<DropboxBackupCard state={getDropboxUiState()} />
				</section>
				<section id="datenverschluesselung" className="scroll-mt-6">
					<SecurityCard status={securityStatus} />
				</section>
				<section id="online-integrationen" className="scroll-mt-6">
					<IntegrationSettingsForm settings={integrations} />
				</section>
				<section id="verbindung" className="scroll-mt-6">
					<ConnectionCard />
				</section>
				<section id="zuruecksetzen" className="scroll-mt-6">
					<ResetAppCard />
				</section>
			</div>
		</div>
	);
}
