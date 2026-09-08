import { SiteHeader } from "@/components/layout/site-header";
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
				<CompanySettingsForm settings={settings} />
				<DataExportCard />
				<DropboxBackupCard state={getDropboxUiState()} />
				<SecurityCard status={securityStatus} />
				<IntegrationSettingsForm settings={integrations} />
				<ConnectionCard />
				<ResetAppCard />
			</div>
		</div>
	);
}
