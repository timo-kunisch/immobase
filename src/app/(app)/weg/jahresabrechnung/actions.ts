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
import { logActivity } from "@/lib/audit";
import { ActionState } from "@/lib/action-state";
import { getString, getDecimalString } from "@/lib/form-data";
import { calculateAnnualStatementResult } from "@/lib/hoa-annual-statement";
import { getT } from "@/lib/i18n/server";
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

async function requireDraftAnnualStatement(annualStatementId: string) {
	const t = await getT();
	const statement = getAnnualStatement(annualStatementId);
	if (!statement) {
		return { error: t("hoaStatement.errors.notFound") } as const;
	}
	if (statement.status !== "DRAFT") {
		return { error: t("hoaStatement.errors.alreadyFinalized") } as const;
	}
	return { statement } as const;
}

/** Kurzbezeichnung des Abrechnungszeitraums für Protokoll-Einträge („2026“ bzw. „2026–2027"). */
function periodLabel(from: Date, to: Date): string {
	return from.getFullYear() === to.getFullYear() ? `${from.getFullYear()}` : `${from.getFullYear()}–${to.getFullYear()}`;
}

// ============================================================
// Jahresabrechnung (AnnualStatement)
// ============================================================

export async function saveAnnualStatementAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const id = getString(formData, "id");
	const hoaId = getString(formData, "hoaId");
	const periodFromRaw = getString(formData, "periodFrom");
	const periodToRaw = getString(formData, "periodTo");
	const notes = getString(formData, "notes");

	if (!hoaId || !periodFromRaw || !periodToRaw) {
		return { error: t("hoaStatement.errors.periodRequired") };
	}

	const periodFrom = new Date(periodFromRaw);
	const periodTo = new Date(periodToRaw);
	if (periodTo < periodFrom) {
		return { error: t("hoaStatement.errors.periodOrder") };
	}

	if (id) {
		const existing = await requireDraftAnnualStatement(id);
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
			logActivity(user, "UPDATE", "jahresabrechnung", `Jahresabrechnung „${periodLabel(periodFrom, periodTo)}“ bearbeitet`, id);
		} else {
			const statement = createAnnualStatement(data);
			logActivity(user, "CREATE", "jahresabrechnung", `Jahresabrechnung „${periodLabel(periodFrom, periodTo)}“ angelegt`, statement.id);
		}
	} catch (error) {
		console.error("saveAnnualStatementAction failed", error);
		return { error: t("hoaStatement.errors.saveFailed") };
	}

	revalidatePath(`/weg/jahresabrechnung`);
	return { success: true };
}

export async function deleteAnnualStatementAction(id: string, _hoaId: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const existing = await requireDraftAnnualStatement(id);
	if ("error" in existing) return { error: existing.error };

	try {
		deleteAnnualStatement(id);
	} catch (error) {
		console.error("deleteAnnualStatementAction failed", error);
		return { error: t("hoaStatement.errors.deleteFailed") };
	}

	logActivity(
		user,
		"DELETE",
		"jahresabrechnung",
		`Jahresabrechnung „${periodLabel(new Date(existing.statement.periodFrom), new Date(existing.statement.periodTo))}“ gelöscht`,
		id
	);

	revalidatePath(`/weg/jahresabrechnung`);
	return { success: true };
}

// ============================================================
// Kostenpositionen (HoaCostItem, context = "STATEMENT")
// ============================================================

export async function saveAnnualStatementCostItemAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
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
		return { error: t("hoaStatement.errors.costItemRequired") };
	}

	const category: HoaCostCategory = HOA_COST_CATEGORIES.includes(categoryRaw) ? categoryRaw : "OTHER";
	if (!HOA_ALLOCATION_KEYS.includes(allocationKeyRaw)) {
		return { error: t("hoaStatement.errors.invalidAllocationKey") };
	}
	if (allocationKeyRaw === "DIRECT" && !directUnitId) {
		return { error: t("hoaStatement.errors.directUnitRequired") };
	}
	if (allocationKeyRaw === "CUSTOM" && !customAllocationKeyId) {
		return { error: t("hoaStatement.errors.customKeyRequired") };
	}

	const existing = await requireDraftAnnualStatement(annualStatementId);
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
			logActivity(user, "UPDATE", "jahresabrechnung", `Kostenposition „${label}“ bearbeitet`, id);
		} else {
			const costItem = createHoaCostItem(data);
			logActivity(user, "CREATE", "jahresabrechnung", `Kostenposition „${label}“ angelegt`, costItem.id);
		}
	} catch (error) {
		console.error("saveAnnualStatementCostItemAction failed", error);
		return { error: t("hoaStatement.errors.costItemSaveFailed") };
	}

	revalidatePath(`/weg/jahresabrechnung/${annualStatementId}`);
	return { success: true };
}

export async function deleteAnnualStatementCostItemAction(id: string, _hoaId: string, annualStatementId: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const existing = await requireDraftAnnualStatement(annualStatementId);
	if ("error" in existing) return { error: existing.error };

	// Bezeichnung vor dem Löschen ermitteln (für den Log-Eintrag).
	const costItem = getHoaCostItem(id);
	try {
		deleteHoaCostItem(id);
	} catch (error) {
		console.error("deleteAnnualStatementCostItemAction failed", error);
		return { error: t("hoaStatement.errors.costItemDeleteFailed") };
	}

	logActivity(user, "DELETE", "jahresabrechnung", `Kostenposition „${costItem ? costItem.label : id}“ gelöscht`, id);

	revalidatePath(`/weg/jahresabrechnung/${annualStatementId}`);
	return { success: true };
}

// ============================================================
// Verbrauchswerte je Einheit und Kostenposition (allocationKey = CONSUMPTION)
// ============================================================

export async function saveHoaConsumptionValuesAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const costItemId = getString(formData, "costItemId");
	if (!costItemId) {
		return { error: t("hoaStatement.errors.invalidCostItem") };
	}

	const costItem = getHoaCostItem(costItemId);
	const annualStatement = costItem?.annualStatementId ? getAnnualStatement(costItem.annualStatementId) : null;
	if (!costItem || !annualStatement) {
		return { error: t("hoaStatement.errors.costItemNotFound") };
	}
	if (annualStatement.status !== "DRAFT") {
		return { error: t("hoaStatement.errors.alreadyFinalized") };
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
		logActivity(user, "UPDATE", "jahresabrechnung", `Verbrauchswerte der Kostenposition „${costItem.label}“ aktualisiert`, costItemId);
	} catch (error) {
		console.error("saveHoaConsumptionValuesAction failed", error);
		return { error: t("hoaStatement.errors.consumptionSaveFailed") };
	}

	revalidatePath(`/weg/jahresabrechnung/${annualStatement.id}`);
	return { success: true };
}

// ============================================================
// Finalisierung: Entwurf -> Einzelabrechnung je Eigentümer-Zeitanteil
// ============================================================

export async function finalizeAnnualStatementAction(annualStatementId: string, _hoaId: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const detail = getAnnualStatementDetail(annualStatementId);

	if (!detail) {
		return { error: t("hoaStatement.errors.notFound") };
	}
	if (detail.statement.status !== "DRAFT") {
		return { error: t("hoaStatement.errors.alreadyFinalizedShort") };
	}
	if (detail.costItems.length === 0) {
		return { error: t("hoaStatement.errors.noCostItems") };
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
		return { error: t("hoaStatement.errors.noOwnerships") };
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
		return { error: t("hoaStatement.errors.finalizeFailed") };
	}

	logActivity(
		user,
		"UPDATE",
		"jahresabrechnung",
		`Jahresabrechnung „${periodLabel(new Date(detail.statement.periodFrom), new Date(detail.statement.periodTo))}“ finalisiert`,
		annualStatementId
	);

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
	const user = await requireUser();
	const t = await getT();
	const unitResultId = getString(formData, "unitResultId");
	const billingPeriodId = getString(formData, "billingPeriodId");

	if (!unitResultId || !billingPeriodId) {
		return { error: t("hoaStatement.errors.bridgeNoPeriod") };
	}

	const bridgeData = getAnnualStatementUnitResultForBridge(unitResultId);
	if (!bridgeData) {
		return { error: t("hoaStatement.errors.bridgeResultNotFound") };
	}

	const period = getBillingPeriod(billingPeriodId);
	if (!period) {
		return { error: t("hoaStatement.errors.bridgePeriodNotFound") };
	}
	if (period.status !== "DRAFT") {
		return { error: t("hoaStatement.errors.bridgePeriodFinalized") };
	}
	if (period.propertyId !== bridgeData.unit.propertyId) {
		return { error: t("hoaStatement.errors.bridgePeriodMismatch") };
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
		return { error: t("hoaStatement.errors.bridgeNoApportionable") };
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
		return { error: t("hoaStatement.errors.bridgeFailed") };
	}

	logActivity(
		user,
		"CREATE",
		"jahresabrechnung",
		`WEG-Einzelabrechnung in die Nebenkostenabrechnung übertragen (${bridgedItems.length} Kostenposition${bridgedItems.length === 1 ? "" : "en"})`,
		unitResultId
	);

	revalidatePath(`/abrechnung/${billingPeriodId}`);
	revalidatePath(`/weg/jahresabrechnung`);
	return { success: true, message: t(bridgedItems.length === 1 ? "hoaStatement.success.bridged.one" : "hoaStatement.success.bridged.other", { count: bridgedItems.length }) };
}
