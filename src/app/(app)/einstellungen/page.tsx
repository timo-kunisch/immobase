import { SiteHeader } from "@/components/layout/site-header";
import { AiCard } from "@/components/einstellungen/ai-card";
import { CompanySettingsForm } from "@/components/einstellungen/company-settings-form";
import { ConnectionCard } from "@/components/einstellungen/connection-card";
import { DataExportCard } from "@/components/einstellungen/data-export-card";
import { DropboxBackupCard } from "@/components/einstellungen/dropbox-backup-card";
import { ImapCard } from "@/components/einstellungen/imap-card";
import { LetterXpressCard } from "@/components/einstellungen/letterxpress-card";
import { McpCard } from "@/components/einstellungen/mcp-card";
import { ResetAppCard } from "@/components/einstellungen/reset-app-card";
import { SecurityCard, type SecurityStatus } from "@/components/einstellungen/security-card";
import { SettingsTabs } from "@/components/einstellungen/settings-tabs";
import { SmtpCard } from "@/components/einstellungen/smtp-card";
import { getCompanySettings } from "@/data/company-settings";
import { getSecretSettingsStatus, getSetting } from "@/data/app-settings";
import { getDatabaseFilePath } from "@/data/paths";
import { isAiConfigured } from "@/lib/ai/config";
import { getDataKeySource } from "@/lib/data-key";
import { getDropboxUiState } from "@/lib/dropbox-backup";
import { getTreeEncryptionStatus } from "@/lib/file-crypto";
import { hasMcpToken, isMcpEnabled } from "@/lib/mcp/auth";
import fs from "node:fs";

export const dynamic = "force-dynamic";

export default async function EinstellungenPage() {
	const settings = getCompanySettings();
	// Gespeicherte Geheimnisse werden NICHT an den Client gegeben - nur die
	// Information, ob sie gesetzt sind (Platzhalter im Formular).
	const smtpSettings = {
		smtpHost: getSetting("smtp.host") ?? "",
		smtpPort: getSetting("smtp.port") ?? "",
		smtpSecure: getSetting("smtp.secure") === "true",
		smtpUser: getSetting("smtp.user") ?? "",
		smtpPassSet: Boolean(getSetting("smtp.pass")),
		smtpFrom: getSetting("smtp.from") ?? "",
	};
	const letterXpressSettings = {
		lxUsername: getSetting("letterxpress.username") ?? "",
		lxApiKeySet: Boolean(getSetting("letterxpress.apikey")),
		lxMode: (getSetting("letterxpress.mode") === "live" ? "live" : "test") as "test" | "live",
	};
	const imapSettings = {
		imapHost: getSetting("imap.host") ?? "",
		imapPort: getSetting("imap.port") ?? "",
		imapSecure: getSetting("imap.secure") !== "false",
		imapUser: getSetting("imap.user") ?? "",
		imapPassSet: Boolean(getSetting("imap.pass")),
		imapMailbox: getSetting("imap.mailbox") ?? "INBOX",
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
				description="Absenderdaten für erzeugte PDFs, Datensicherung, Integrationen & KI und Sicherheit - thematisch gruppiert in Bereichen."
			/>

			<div className="flex-1 p-4 sm:p-6">
				<SettingsTabs
					tabs={[
						{
							value: "allgemein",
							label: "Allgemein",
							content: (
								<>
									<CompanySettingsForm settings={settings} />
									<ConnectionCard />
								</>
							),
						},
						{
							value: "datensicherung",
							label: "Datensicherung",
							content: (
								<>
									<DataExportCard />
									<DropboxBackupCard state={getDropboxUiState()} />
								</>
							),
						},
						{
							value: "integrationen",
							label: "Integrationen & KI",
							content: (
								<>
									<p className="max-w-xl text-sm text-muted-foreground">
										Die App läuft vollständig offline. Alle Dienste in diesem Bereich sind optional und lassen sich einzeln
										einrichten.
									</p>
									<SmtpCard settings={smtpSettings} />
									<ImapCard settings={imapSettings} />
									<LetterXpressCard settings={letterXpressSettings} />
									<AiCard
										state={{
											baseUrl: getSetting("ai.base_url") ?? "",
											model: getSetting("ai.model") ?? "",
											apiKeySet: Boolean(getSetting("ai.apikey")),
											configured: isAiConfigured(),
										}}
									/>
									<McpCard
										state={{ enabled: isMcpEnabled(), adminTokenSet: hasMcpToken("ADMIN"), userTokenSet: hasMcpToken("USER") }}
									/>
								</>
							),
						},
						{
							value: "sicherheit",
							label: "Sicherheit",
							content: (
								<>
									<SecurityCard status={securityStatus} />
									<ResetAppCard />
								</>
							),
						},
					]}
				/>
			</div>
		</div>
	);
}
