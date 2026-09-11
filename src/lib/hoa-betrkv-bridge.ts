import type { AllocationKey } from "@/data/types";
import { centsToDecimalString } from "@/lib/money";

/**
 * Brücke zwischen der WEG-Jahresabrechnung und der bestehenden
 * Nebenkostenabrechnung (Betriebskostenabrechnung nach § 2 BetrKV, siehe
 * src/lib/billing.ts) für VERMIETETE Eigentumswohnungen.
 *
 * Hintergrund: Ist eine WEG-Einheit vermietet (leases.unitId = units.id),
 * muss der Eigentümer (= Vermieter) seinem Mieter gegenüber weiterhin nach
 * § 556 BGB / BetrKV abrechnen - NICHT nach WEG-Regeln. Die Kostenpositionen
 * dafür stammen jedoch größtenteils aus der WEG-Jahresabrechnung (Wasser,
 * Heizung, Hauswart, Versicherung, ...), abzüglich der NICHT umlagefähigen
 * Positionen (Verwaltervergütung, Zuführung zur Erhaltungsrücklage,
 * Rechtsberatung, Bankgebühren - das sind reine Verwaltungskosten des
 * Eigentümers, § 1 Abs. 2 Nr. 1 BetrKV/BGH-Rechtsprechung).
 *
 * Welche Positionen umlagefähig sind, entscheidet ALLEIN das explizite
 * Nutzer-Flag `hoaCostItems.isApportionable` je Kostenposition (siehe
 * Annahme 8 in AGENTS.md Abschnitt 6.1). Die frühere Kostenart-Kategorie
 * (inkl. Default-Matrix) ist entfallen - die Bezeichnung (label) trägt die
 * fachliche Information selbst (gleiche Bereinigung wie cost_items.category
 * in der Mietverwaltung, Migration 0010/0013).
 *
 * Diese Datei kapselt ausschließlich die REINE Umwandlungslogik (Filterung
 * nach isApportionable, Betragsübernahme) - der eigentliche "Import"
 * (Anlegen von costItems/consumptionValues in einer bestehenden Nebenkosten-
 * abrechnungsperiode) erfolgt als Server Action (siehe src/app/(app)/weg/
 * jahresabrechnung/actions.ts), die diese Funktionen aufruft.
 *
 * Getroffene Annahme: Der Übertrag erfolgt je Kostenposition als eigene,
 * DIREKT der vermieteten Einheit zugeordnete Position (allocationKey
 * "DIRECT") in Höhe des bereits für diese Einheit berechneten WEG-Anteils
 * (annualStatementUnitResultLines.amount) - es findet KEINE erneute
 * Verteilung auf mehrere Mieteinheiten derselben Liegenschaft statt, da der
 * WEG-Anteil bereits exakt auf die jeweilige Eigentumswohnung entfällt.
 */

export type HoaAnnualStatementLineForBridge = {
	costItemId: string;
	label: string;
	isApportionable: boolean;
	amountCents: number;
};

export type BridgedBetrKvCostItem = {
	label: string;
	allocationKey: AllocationKey;
	amount: string;
	notes: string;
	/** Referenz auf die WEG-Quellposition, für Nachvollziehbarkeit in der Notiz/Anzeige. */
	sourceHoaCostItemId: string;
};

/**
 * Wandelt die umlagefähigen Zeilen einer WEG-Einzelabrechnung
 * (annualStatementUnitResultLines) in Kostenpositionen für die
 * Nebenkostenabrechnung (costItems, allocationKey "DIRECT") der VERMIETETEN
 * Einheit um. Nicht umlagefähige Positionen (isApportionable = false)
 * werden herausgefiltert - sie betreffen ausschließlich das
 * Eigentümer-Innenverhältnis und dürfen dem Mieter nicht berechnet werden.
 */
export function buildBetrKvCostItemsFromHoaStatement(lines: HoaAnnualStatementLineForBridge[]): BridgedBetrKvCostItem[] {
	return lines
		.filter((line) => line.isApportionable && line.amountCents !== 0)
		.map((line) => ({
			label: line.label,
			allocationKey: "DIRECT" as AllocationKey,
			amount: centsToDecimalString(line.amountCents),
			notes: "Übernommen aus der WEG-Jahresabrechnung.",
			sourceHoaCostItemId: line.costItemId,
		}));
}
