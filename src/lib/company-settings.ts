import type { CompanySettings } from "@/data/types";

export {
	getCompanySettings,
	saveCompanySettings,
	companySettingsToAddressLines,
} from "@/data/company-settings";

/**
 * Absenderdaten (Vermieter/Hausverwaltung) für erzeugte PDFs.
 *
 * Diese Datei ist nur noch eine schmale Kompatibilitäts-Fassade für
 * bestehende Importe (`@/lib/company-settings`) - die Implementierung liegt
 * im Repository-Layer unter src/data/company-settings.ts (direkter
 * better-sqlite3-Zugriff). Neue Aufrufer sollten direkt `@/data/company-settings`
 * importieren; die hier re-exportierten Funktionen sind synchron (ein
 * etwaiges `await` alter Aufrufer ist harmlos).
 */
export type { CompanySettings };
export type CompanySettingsRow = CompanySettings;
