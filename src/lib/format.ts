/**
 * Kleine, wiederverwendbare Formatierungs-Helfer für die gesamte App.
 */

const currencyFormatter = new Intl.NumberFormat("de-DE", {
	style: "currency",
	currency: "EUR",
});

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
	day: "2-digit",
	month: "2-digit",
	year: "numeric",
});

const numberFormatter = new Intl.NumberFormat("de-DE");

/** Formatiert einen Betrag (Decimal-String, number) als EUR-Währung. */
export function formatCurrency(value: number | string | null | undefined): string {
	if (value === null || value === undefined) return "–";
	const numeric = typeof value === "number" ? value : Number(value);
	if (Number.isNaN(numeric)) return "–";
	return currencyFormatter.format(numeric);
}

/** Formatiert ein Datum im deutschen Format (TT.MM.JJJJ). */
export function formatDate(value: Date | string | null | undefined): string {
	if (!value) return "–";
	const date = typeof value === "string" ? new Date(value) : value;
	if (Number.isNaN(date.getTime())) return "–";
	return dateFormatter.format(date);
}

/** Formatiert eine Zahl (z. B. m² oder Zimmeranzahl) im deutschen Format. */
export function formatNumber(value: number | string | null | undefined): string {
	if (value === null || value === undefined) return "–";
	const numeric = typeof value === "number" ? value : Number(value);
	if (Number.isNaN(numeric)) return "–";
	return numberFormatter.format(numeric);
}

/** Formatiert einen Prozentsatz (0-100) mit einer Nachkommastelle. */
export function formatPercent(value: number): string {
	if (Number.isNaN(value)) return "–";
	return `${value.toFixed(1)} %`;
}

/** Formatiert eine Dateigröße in Bytes menschenlesbar (KB/MB). */
export function formatFileSize(bytes: number | null | undefined): string {
	if (!bytes) return "–";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Wandelt einen Date-Wert in das für <input type="date"> benötigte Format (YYYY-MM-DD) um. */
export function toDateInputValue(value: Date | string | null | undefined): string {
	if (!value) return "";
	const date = typeof value === "string" ? new Date(value) : value;
	if (Number.isNaN(date.getTime())) return "";
	return date.toISOString().slice(0, 10);
}
