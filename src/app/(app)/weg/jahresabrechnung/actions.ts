"use server";

import { revalidatePath } from "next/cache";

import {
	createAnnualStatement,
	createHoaCostItem,
	deleteAnnualStatement,
	deleteHoaCostItem,
	finalizeAnnualStatement,
	getAnnualStatement,
	getAnnualStatementDetail,
	getAnnualStatementUnitResultForBridge,
	getHoaCostItem,
	listCustomAllocationKeyWeights,
	listHousingChargesForUnits,
	saveHoaConsumptionValuesForCostItem,
	updateAnnualStatement,
	updateHoaCostItem,
} from "@/data/annual-statements";
import { createCostItem, getBillingPeriod } from "@/data/billing";
import type { HoaAllocationKey, HoaCostCategory } from "@/data/types";
import { requireUser } from "@/lib/auth/dal";
import { ActionState } from "@/lib/action-state";
import { getString, getDecimalString } from "@/lib/form-data";
import { calculateAnnualStatementResult } from "@/lib/hoa-annual-statement";
import { centsToDecimalString } from "@/lib/money";
import { buildBetrKvCostItemsFromHoaStatement } from "@/lib/hoa-betrkv-bridge";

const HOA_ALLOCATION_KEYS: HoaAllocationKey[] = ["MEA", "LIVING_SPACE", "UNITS", "CONSUMPTION", "DIRECT", "CUSTOM"];
const HOA_COST_CATEGORIES: HoaCostCategory[] = [
	"RESERVE_CONTRIBUTION",
	"ADMINISTRATOR_FEE",
	"INSURANCE",
	"CARETAKER",
	"MAINTENANCE_REPAIR",
	"WATER_DRAINAGE",
	"HEATING",
	"ELECTRICITY_COMMON",
	"CLEANING",
	"GARDEN_MAINTENANCE",
	"ELEVATOR",
	"LEGAL_ADVICE",
	"BANK_FEES",
	"OTHER",
];

function requireDraftAnnualStatement(annualStatementId: string) {
	const statement = getAnnualStatement(annualStatementId);
	if (!statement) {
		return { error: "Die Jahresabrechnung wurde nicht gefunden." } as const;
	}
	if (statement.status !== "DRAFT") {
		return { error: "Diese Jahresabrechnung ist bereits finalisiert und kann nicht mehr geändert werden." } as const;
	}
	return { statement } as const;
}

// ============================================================
// Jahresabrechnung (AnnualStatement)
// ============================================================

export async function saveAnnualStatementAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	const id = getString(formData, "id");
	const hoaId = getString(formData, "hoaId");
	const periodFromRaw = getString(formData, "periodFrom");
	const periodToRaw = getString(formData, "periodTo");
	const notes = getString(formData, "notes");

	if (!hoaId || !periodFromRaw || !periodToRaw) {
		return { error: "Bitte den Abrechnungszeitraum (von/bis) angeben." };
	}

	const periodFrom = new Date(periodFromRaw);
	const periodTo = new Date(periodToRaw);
	if (periodTo < periodFrom) {
		return { error: "Das Ende des Zeitraums darf nicht vor dem Beginn liegen." };
	}

	if (id) {
		const existing = requireDraftAnnualStatement(id);
		if ("error" in existing) return { error: existing.error };
	}

	const data = {
		hoaId,
		periodFrom: periodFrom.toISOString(),
		periodTo: periodTo.toISOString(),
		notes: notes || null,
	};

	try {
		if (id) {
			updateAnnualStatement(id, data);
		} else {
			createAnnualStatement(data);
		}
	} catch (error) {
		console.error("saveAnnualStatementAction failed", error);
		return { error: "Die Jahresabrechnung konnte nicht gespeichert werden." };
	}

	revalidatePath(`/weg/jahresabrechnung`);
	return { success: true };
}

export async function deleteAnnualStatementAction(id: string, _hoaId: string): Promise<ActionState> {
	await requireUser();
	const existing = requireDraftAnnualStatement(id);
	if ("error" in existing) return { error: existing.error };

	try {
		deleteAnnualStatement(id);
	} catch (error) {
		console.error("deleteAnnualStatementAction failed", error);
		return { error: "Die Jahresabrechnung konnte nicht gelöscht werden." };
	}

	revalidatePath(`/weg/jahresabrechnung`);
	return { success: true };
}

// ============================================================
// Kostenpositionen (HoaCostItem, context = "STATEMENT")
// ============================================================

export async function saveAnnualStatementCostItemAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	const id = getString(formData, "id");
	const annualStatementId = getString(formData, "annualStatementId");
	const categoryRaw = getString(formData, "category") as HoaCostCategory;
	const label = getString(formData, "label");
	const amount = getDecimalString(formData, "amount");
	const allocationKeyRaw = getString(formData, "allocationKey") as HoaAllocationKey;
	const directUnitId = getString(formData, "directUnitId");
	const customAllocationKeyId = getString(formData, "customAllocationKeyId");
	const isApportionable = formData.get("isApportionable") === "on";
	const notes = getString(formData, "notes");

	if (!annualStatementId || !label || amount === null || !allocationKeyRaw) {
		return { error: "Bitte Bezeichnung, Betrag und Umlageschlüssel angeben." };
	}

	const category: HoaCostCategory = HOA_COST_CATEGORIES.includes(categoryRaw) ? categoryRaw : "OTHER";
	if (!HOA_ALLOCATION_KEYS.includes(allocationKeyRaw)) {
		return { error: "Ungültiger Umlageschlüssel." };
	}
	if (allocationKeyRaw === "DIRECT" && !directUnitId) {
		return { error: "Bei direkter Zuordnung muss eine Einheit ausgewählt werden." };
	}
	if (allocationKeyRaw === "CUSTOM" && !customAllocationKeyId) {
		return { error: "Bei einem frei definierten Schlüssel muss dieser ausgewählt werden." };
	}

	const existing = requireDraftAnnualStatement(annualStatementId);
	if ("error" in existing) return { error: existing.error };

	const data = {
		context: "STATEMENT" as const,
		economicPlanId: null,
		annualStatementId,
		category,
		label,
		amount,
		allocationKey: allocationKeyRaw,
		directUnitId: allocationKeyRaw === "DIRECT" ? directUnitId : null,
		customAllocationKeyId: allocationKeyRaw === "CUSTOM" ? customAllocationKeyId : null,
		isApportionable,
		notes: notes || null,
	};

	try {
		if (id) {
			updateHoaCostItem(id, data);
		} else {
			createHoaCostItem(data);
		}
	} catch (error) {
		console.error("saveAnnualStatementCostItemAction failed", error);
		return { error: "Die Kostenposition konnte nicht gespeichert werden." };
	}

	revalidatePath(`/weg/jahresabrechnung/${annualStatementId}`);
	return { success: true };
}

export async function deleteAnnualStatementCostItemAction(id: string, _hoaId: string, annualStatementId: string): Promise<ActionState> {
	await requireUser();
	const existing = requireDraftAnnualStatement(annualStatementId);
	if ("error" in existing) return { error: existing.error };

	try {
		deleteHoaCostItem(id);
	} catch (error) {
		console.error("deleteAnnualStatementCostItemAction failed", error);
		return { error: "Die Kostenposition konnte nicht gelöscht werden." };
	}

	revalidatePath(`/weg/jahresabrechnung/${annualStatementId}`);
	return { success: true };
}

// ============================================================
// Verbrauchswerte je Einheit und Kostenposition (allocationKey = CONSUMPTION)
// ============================================================

export async function saveHoaConsumptionValuesAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	const costItemId = getString(formData, "costItemId");
	if (!costItemId) {
		return { error: "Ungültige Kostenposition." };
	}

	const costItem = getHoaCostItem(costItemId);
	const annualStatement = costItem?.annualStatementId ? getAnnualStatement(costItem.annualStatementId) : null;
	if (!costItem || !annualStatement) {
		return { error: "Die Kostenposition wurde nicht gefunden." };
	}
	if (annualStatement.status !== "DRAFT") {
		return { error: "Diese Jahresabrechnung ist bereits finalisiert und kann nicht mehr geändert werden." };
	}

	const unitIds: string[] = [];
	for (const key of formData.keys()) {
		const match = /^value-(.+)$/.exec(key);
		if (match) unitIds.push(match[1]);
	}

	try {
		saveHoaConsumptionValuesForCostItem(
			costItemId,
			unitIds.map((unitId) => {
				const raw = getString(formData, `value-${unitId}`).replace(",", ".");
				const parsed = raw ? Number(raw) : 0;
				const value = Number.isNaN(parsed) ? "0" : parsed.toFixed(3);
				return { unitId, value };
			})
		);
	} catch (error) {
		console.error("saveHoaConsumptionValuesAction failed", error);
		return { error: "Die Verbrauchswerte konnten nicht gespeichert werden." };
	}

	revalidatePath(`/weg/jahresabrechnung/${annualStatement.id}`);
	return { success: true };
}

// ============================================================
// Finalisierung: Entwurf -> Einzelabrechnung je Eigentümer-Zeitanteil
// ============================================================

export async function finalizeAnnualStatementAction(annualStatementId: string, _hoaId: string): Promise<ActionState> {
	await requireUser();
	const detail = getAnnualStatementDetail(annualStatementId);

	if (!detail) {
		return { error: "Die Jahresabrechnung wurde nicht gefunden." };
	}
	if (detail.statement.status !== "DRAFT") {
		return { error: "Diese Jahresabrechnung wurde bereits finalisiert." };
	}
	if (detail.costItems.length === 0) {
		return { error: "Bitte erfassen Sie mindestens eine Kostenposition, bevor Sie finalisieren." };
	}

	const units = detail.units;

	const customWeightsByKey = new Map<string, { unitId: string; weight: number }[]>();
	for (const costItem of detail.costItems) {
		if (costItem.allocationKey !== "CUSTOM" || !costItem.customAllocationKeyId) continue;
		if (customWeightsByKey.has(costItem.customAllocationKeyId)) continue;
		const weights = listCustomAllocationKeyWeights(costItem.customAllocationKeyId);
		customWeightsByKey.set(costItem.customAllocationKeyId, weights.map((w) => ({ unitId: w.unitId, weight: w.weight })));
	}

	const housingChargeRows = listHousingChargesForUnits(units.map((u) => u.id));

	const result = calculateAnnualStatementResult(
		{
			periodFrom: new Date(detail.statement.periodFrom),
			periodTo: new Date(detail.statement.periodTo),
			units: units.map((unit) => ({
				id: unit.id,
				livingSpace: unit.livingSpace,
				coOwnershipShare: unit.coOwnershipShare,
				ownerships: unit.ownerships.map((o) => ({ id: o.id, ownerId: o.ownerId, startDate: o.startDate, endDate: o.endDate })),
			})),
			costItems: detail.costItems.map((costItem) => ({
				id: costItem.id,
				amount: costItem.amount,
				allocationKey: costItem.allocationKey,
				directUnitId: costItem.directUnitId,
				consumptionValues: costItem.consumptionValues,
				customAllocationWeights: costItem.customAllocationKeyId ? customWeightsByKey.get(costItem.customAllocationKeyId) ?? [] : [],
			})),
		},
		housingChargeRows.map((c) => ({ unitId: c.unitId, ownerId: c.ownerId, amount: c.amount, dueDate: c.dueDate, status: c.status }))
	);

	if (result.ownerResults.length === 0) {
		return { error: "Für den gewählten Zeitraum wurden keine Eigentumsverhältnisse gefunden, die abgerechnet werden könnten." };
	}

	// Atomar in einer Transaktion (src/data/annual-statements.ts) - ein
	// Fehler hinterlässt keine teilweise geschriebenen Einzelabrechnungen.
	try {
		finalizeAnnualStatement(
			annualStatementId,
			result.ownerResults.map((ownerResult) => ({
				unitId: ownerResult.unitId,
				ownerId: ownerResult.ownerId,
				ownedFrom: ownerResult.ownedFrom.toISOString(),
				ownedTo: ownerResult.ownedTo.toISOString(),
				ownedDays: ownerResult.ownedDays,
				totalAllocatedCosts: centsToDecimalString(ownerResult.totalAllocatedCostsCents),
				totalPrepayments: centsToDecimalString(ownerResult.totalPrepaymentsCents),
				balance: centsToDecimalString(ownerResult.balanceCents),
				lines: ownerResult.lines.map((line) => ({
					costItemId: line.costItemId,
					amount: centsToDecimalString(line.amountCents),
				})),
			}))
		);
	} catch (error) {
		console.error("finalizeAnnualStatementAction failed", error);
		return { error: "Die Jahresabrechnung konnte nicht finalisiert werden." };
	}

	revalidatePath(`/weg/jahresabrechnung/${annualStatementId}`);
	revalidatePath(`/weg/jahresabrechnung`);
	return { success: true };
}

// ============================================================
// BetrKV-Brücke: umlagefähige Positionen in eine bestehende
// Nebenkostenabrechnungsperiode einer vermieteten Einheit übertragen
// ============================================================

/**
 * Überträgt die umlagefähigen Kostenpositionen der WEG-Einzelabrechnung
 * einer Einheit (unitResultId) in eine bestehende (Entwurfs-)
 * Abrechnungsperiode der Nebenkostenabrechnung als neue, direkt
 * zugeordnete Kostenpositionen (siehe src/lib/hoa-betrkv-bridge.ts).
 * Voraussetzung: Die Zieleinheit ist tatsächlich vermietet, d. h. Teil der
 * Liegenschaft der gewählten Abrechnungsperiode.
 */
export async function bridgeToBetrKvAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	const unitResultId = getString(formData, "unitResultId");
	const billingPeriodId = getString(formData, "billingPeriodId");

	if (!unitResultId || !billingPeriodId) {
		return { error: "Bitte eine Nebenkostenabrechnungsperiode auswählen." };
	}

	const bridgeData = getAnnualStatementUnitResultForBridge(unitResultId);
	if (!bridgeData) {
		return { error: "Die WEG-Einzelabrechnung wurde nicht gefunden." };
	}

	const period = getBillingPeriod(billingPeriodId);
	if (!period) {
		return { error: "Die Nebenkostenabrechnungsperiode wurde nicht gefunden." };
	}
	if (period.status !== "DRAFT") {
		return { error: "Diese Abrechnungsperiode ist bereits finalisiert und kann nicht mehr geändert werden." };
	}
	if (period.propertyId !== bridgeData.unit.propertyId) {
		return { error: "Die gewählte Abrechnungsperiode gehört nicht zur Liegenschaft dieser Einheit." };
	}

	const bridgedItems = buildBetrKvCostItemsFromHoaStatement(
		bridgeData.lines.map((line) => ({
			costItemId: line.costItemId,
			label: line.costItem.label,
			category: line.costItem.category,
			isApportionable: line.costItem.isApportionable,
			amountCents: Math.round(Number(line.amount) * 100),
		}))
	);

	if (bridgedItems.length === 0) {
		return { error: "Diese WEG-Einzelabrechnung enthält keine umlagefähigen Positionen." };
	}

	try {
		for (const item of bridgedItems) {
			createCostItem({
				billingPeriodId,
				category: item.category,
				label: item.label,
				amount: item.amount,
				allocationKey: item.allocationKey,
				directUnitId: bridgeData.unitResult.unitId,
				notes: item.notes,
			});
		}
	} catch (error) {
		console.error("bridgeToBetrKvAction failed", error);
		return { error: "Der Übertrag in die Nebenkostenabrechnung ist fehlgeschlagen." };
	}

	revalidatePath(`/abrechnung/${billingPeriodId}`);
	revalidatePath(`/weg/jahresabrechnung`);
	return { success: true, message: `${bridgedItems.length} Kostenposition${bridgedItems.length === 1 ? "" : "en"} übertragen.` };
}
