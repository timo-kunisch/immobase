import { setup as deSetup } from "../de/setup";

/** Englische Übersetzungen des Namespace "setup" (Parität per Typ erzwungen). */
export const setup: typeof deSetup = {
	// Page title (browser tab via generateMetadata)
	"meta.title": "Initial setup – ImmoBase",
	// Step bar
	"steps.welcome": "Welcome",
	"steps.mode": "Operating mode",
	"steps.company": "Sender details",
	"steps.integrations": "Online integrations",
	"steps.recoveryKey": "Recovery key",
	"steps.account": "Administrator account",
	"progress.stepOf": "Step {step} of {total}: {title}",
	// Step 1: Welcome
	"welcome.title": "Welcome to ImmoBase",
	"welcome.description": "The initial setup guides you through the basic settings of the app in a few steps.",
	"welcome.offline": "ImmoBase runs completely offline – all data stays on this computer.",
	"welcome.stepsIntro": "The following steps set up the app:",
	"welcome.itemMode": "Operating mode (local/host/client – desktop app)",
	"welcome.itemCompany": "Sender details for generated PDFs (optional)",
	"welcome.itemIntegrations": "Online integrations (overview – the setup takes place later under “Settings”)",
	"welcome.itemRecoveryKey": "Secure the recovery key of the local data encryption (required)",
	"welcome.itemAccount": "Your administrator account (required)",
	"welcome.optionalHint": "Optional steps can be skipped and completed later at any time under “Settings”.",
	"welcome.start": "Start setup",
	// Step 2: Operating mode (title = steps.mode)
	"mode.description":
		"How would you like to use ImmoBase? You can change this choice later at any time under “Settings” → “Connection & multi-user”.",
	"mode.options.local.title": "Local (default)",
	"mode.options.local.description": "This computer only. All data stays here.",
	"mode.options.host.title": "Host",
	"mode.options.host.description": "This computer provides the data on the local network.",
	"mode.options.client.title": "Client",
	"mode.options.client.description": "Connect to a host on the local network (no local data).",
	"mode.browserHint":
		"Mode selection is only available in the desktop app – in the browser ImmoBase always runs locally on this computer.",
	"mode.hostHint":
		"The database is always located on the host's local hard drive – never on a network drive (SMB/NFS). Clients need the host's address and the access token.",
	"mode.clientHint":
		"In client mode, no data is stored on this device. After the selection, the connection page opens where you select the host and enter the access token. The remaining setup steps are skipped on this device – they are performed on the host.",
	// Step 3: Sender details (title = steps.company)
	"company.description":
		"These details appear as the letterhead on generated PDFs (e.g. utility statements). Optional – can be updated at any time under “Settings”.",
	"company.skip": "Skip",
	"company.saveAndNext": "Save and continue",
	"fields.name": "Name / company",
	"fields.namePlaceholder": "John Doe Property Management",
	"fields.street": "Street and house number",
	"fields.streetPlaceholder": "123 Main Street",
	"fields.zipCode": "ZIP code",
	"fields.city": "City",
	"fields.cityPlaceholder": "Springfield",
	"fields.additional": "Additional information",
	"fields.additionalPlaceholder": "e.g. bank details, tax number, contact details",
	// Step 4: Online integrations (info step)
	"integrations.title": "Online integrations (optional)",
	"integrations.description":
		"ImmoBase runs completely offline – all data stays on this computer. You can set up the following optional services after the initial setup under “Settings” if needed.",
	"integrations.groupIntegrations": "Settings → “Integrations & AI”",
	"integrations.itemSmtp": "Email sending (SMTP) – e.g. for verification and ticket emails",
	"integrations.itemImap": "Email mailbox (IMAP) – incoming emails in the ticket system",
	"integrations.itemLetterxpress": "Postal delivery (LetterXpress) – PDFs (e.g. statements) as physical letters",
	"integrations.itemAi": "AI assistant – chatbot in the sidebar via an OpenAI-compatible endpoint",
	"integrations.itemMcp": "MCP server – read and write access for external AI clients to the domain data",
	"integrations.groupBackup": "Settings → “Backup”",
	"integrations.itemDropbox": "Dropbox backup – automatic, optionally password-protected cloud backup",
	"integrations.smtpHint":
		"Without SMTP configuration, all email functions (verification, password reset) are disabled – the ticket system and all other functions run offline without restrictions.",
	// Step 5: Recovery key
	"recovery.title": "Secure the recovery key",
	"recovery.description":
		"ImmoBase encrypts your database, stored files and saved credentials on this device (AES-256). The corresponding key is bound to this device.",
	"recovery.explanation":
		"With the following recovery key you can decrypt your data if the device key is lost (e.g. after reinstalling the operating system). Keep it like a password in a safe place – without it, the encrypted data is irretrievably lost in this case. Anyone who has the key can decrypt all data: do not show it to anyone.",
	"recovery.loading": "Loading key …",
	"recovery.copy": "Copy to clipboard",
	"recovery.copied": "Copied",
	"recovery.confirm": "I have securely stored the recovery key outside of this device (e.g. written down or in a password manager).",
	"recovery.laterHint": "The key can be viewed again at any time under “Settings” → “Local data encryption”.",
	// Step 6: Administrator account (email/password field labels from the auth namespace)
	"account.title": "Create administrator account",
	"account.description": "Finally, your user account is created. The first account automatically receives administrator rights.",
	"account.submit": "Create account and finish setup",
	// Errors from server actions and steps
	"errors.saveCompany": "The details could not be saved.",
	"errors.recoveryKeyRead": "The recovery key could not be read.",
	"errors.modeApply": "The mode could not be applied.",
	"errors.accountCreate": "The account could not be created.",
};
