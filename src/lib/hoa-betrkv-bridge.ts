import type { AllocationKey, CostCategory, HoaCostCategory } from "@/data/types";
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
 * Diese Datei kapselt ausschließlich die REINE Umwandlungslogik (Mapping
 * der Kostenarten, Filterung nach isApportionable, Betragsübernahme) - der
 * eigentliche "Import" (Anlegen von costItems/consumptionValues in einer
 * bestehenden Nebenkostenabrechnungsperiode) erfolgt als Server Action
 * (siehe src/app/(app)/weg/jahresabrechnung/actions.ts), die diese
 * Funktionen aufruft.
 *
 * Getroffene Annahme: Der Übertrag erfolgt je Kostenposition als eigene,
 * DIREKT der vermieteten Einheit zugeordnete Position (allocationKey
 * "DIRECT") in Höhe des bereits für diese Einheit berechneten WEG-Anteils
 * (annualStatementUnitResultLines.amount) - es findet KEINE erneute
 * Verteilung auf mehrere Mieteinheiten derselben Liegenschaft statt, da der
 * WEG-Anteil bereits exakt auf die jeweilige Eigentumswohnung entfällt.
 */

/**
 * Default-Vorbelegung für `hoaCostItems.isApportionable` beim Anlegen einer
 * neuen Kostenposition in der Jahresabrechnung, je nach Kostenart - siehe
 * schema.ts-Kommentar zu hoaCostItems.isApportionable. Bewusst nur ein
 * Vorschlag (vom Nutzer pro Position änderbar), da im Einzelfall auch z. B.
 * eine Rechtsberatung umlagefähig sein könnte (z. B. Rechtsstreit über eine
 * Betriebskostenposition).
 */
export const hoaCostCategoryDefaultApportionable: Record<HoaCostCategory, boolean> = {
	RESERVE_CONTRIBUTION: false,
	ADMINISTRATOR_FEE: false,
	LEGAL_ADVICE: false,
	BANK_FEES: false,
	INSURANCE: true,
	CARETAKER: true,
	MAINTENANCE_REPAIR: false,
	WATER_DRAINAGE: true,
	HEATING: true,
	ELECTRICITY_COMMON: true,
	CLEANING: true,
	GARDEN_MAINTENANCE: true,
	ELEVATOR: true,
	OTHER: false,
};

/**
 * Mapping der WEG-Kostenarten auf die entsprechende BetrKV-Kostenart (§ 2
 * BetrKV Nr. 1-17, siehe CostCategory in src/db/schema.ts) für den
 * Übertrag in die Nebenkostenabrechnung. Kategorien ohne sinnvolle
 * BetrKV-Entsprechung (Verwaltervergütung, Rücklage, Rechtsberatung,
 * Bankgebühren) werden nicht umlagefähig vorbelegt (siehe oben) und daher
 * i. d. R. nicht übertragen - das Mapping ist trotzdem für alle Kategorien
 * vollständig definiert, falls ein Nutzer eine dieser Kategorien manuell
 * doch als umlagefähig markiert.
 */
export const hoaCostCategoryToBetrKvCategory: Record<HoaCostCategory, CostCategory> = {
	RESERVE_CONTRIBUTION: "OTHER",
	ADMINISTRATOR_FEE: "OTHER",
	INSURANCE: "INSURANCE",
	CARETAKER: "CARETAKER",
	MAINTENANCE_REPAIR: "OTHER",
	WATER_DRAINAGE: "WATER_SUPPLY",
	HEATING: "HEATING",
	ELECTRICITY_COMMON: "LIGHTING",
	CLEANING: "BUILDING_CLEANING_PEST_CONTROL",
	GARDEN_MAINTENANCE: "GARDEN_MAINTENANCE",
	ELEVATOR: "ELEVATOR",
	LEGAL_ADVICE: "OTHER",
	BANK_FEES: "OTHER",
	OTHER: "OTHER",
};

export type HoaAnnualStatementLineForBridge = {
	costItemId: string;
	label: string;
	category: HoaCostCategory;
	isApportionable: boolean;
	amountCents: number;
};

export type BridgedBetrKvCostItem = {
	label: string;
	category: CostCategory;
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
			category: hoaCostCategoryToBetrKvCategory[line.category],
			allocationKey: "DIRECT" as AllocationKey,
			amount: centsToDecimalString(line.amountCents),
			notes: "Übernommen aus der WEG-Jahresabrechnung.",
			sourceHoaCostItemId: line.costItemId,
		}));
}
