import { toast } from "sonner";

/**
 * Zeigt eine Fehlermeldung als Toast an. Zentraler Durchgang für sämtliche
 * Fehlermeldungen aus Server Actions, damit Darstellung und Anzeigedauer
 * einheitlich sind - bewusst länger als Standard, weil Fehlertexte meist
 * eine Handlungsanleitung enthalten (z. B. "zuerst Einheiten löschen").
 */
export function showError(message: string): void {
	toast.error(message, { duration: 8000 });
}

/** Zeigt eine Erfolgsmeldung als Toast an (kurze Bestätigung). */
export function showSuccess(message: string): void {
	toast.success(message);
}