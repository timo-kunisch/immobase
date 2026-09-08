"use server";

import { revalidatePath } from "next/cache";

import { getHoaCostItem } from "@/data/annual-statements";
import {
	createEconomicPlan,
	createEconomicPlanCostItem,
	deleteEconomicPlan,
	deleteEconomicPlanCostItem,
	finalizeEconomicPlan,
	generateHousingCharges,
	getEconomicPlan,
	getEconomicPlanDetail,
	listCustomAllocationKeyWeights,
	listEconomicPlanUnitShares,
	listUnitOwnershipsForUnits,
	updateEconomicPlan,
	updateEconomicPlanCostItem,
	type DueHousingChargeCandidate,
} from "@/data/economic-plans";
import { requireUser } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { ActionState } from "@/lib/action-state";
import { getString, getDecimalString } from "@/lib/form-data";
import { calculateEconomicPlanResult } from "@/lib/hoa-economic-plan";
import { findOwnershipForDate } from "@/lib/hoa-ownership";
import type { HoaAllocationKey, HoaCostCategory } from "@/data/types";

const HOA_ALLOCATION_KEYS: HoaAllocationKey[] = ["MEA", "LIVING_SPACE", "UNITS", "DIRECT", "CUSTOM"];
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

/** Lädt einen Wirtschaftsplan und prüft, dass er noch im Entwurf ist. */
function requireDraftEconomicPlan(economicPlanId: string) {
	const plan = getEconomicPlan(economicPlanId);
	if (!plan) {
		return { error: "Der Wirtschaftsplan wurde nicht gefunden." } as const;
	}
	if (plan.status !== "DRAFT") {
		return { error: "Dieser Wirtschaftsplan ist bereits finalisiert und kann nicht mehr geändert werden." } as const;
	}
	return { plan } as const;
}

/** Kurzbezeichnung des Geschäftsjahrs für Protokoll-Einträge („2026“ bzw. „2026–2027"). */
function fiscalYearLabel(from: Date, to: Date): string {
	return from.getFullYear() === to.getFullYear() ? `${from.getFullYear()}` : `${from.getFullYear()}–${to.getFullYear()}`;
}

// ============================================================
// Wirtschaftsplan (EconomicPlan)
// ============================================================

export async function saveEconomicPlanAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const id = getString(formData, "id");
	const hoaId = getString(formData, "hoaId");
	const fiscalYearFromRaw = getString(formData, "fiscalYearFrom");
	const fiscalYearToRaw = getString(formData, "fiscalYearTo");
	const notes = getString(formData, "notes");

	if (!hoaId || !fiscalYearFromRaw || !fiscalYearToRaw) {
		return { error: "Bitte das Geschäftsjahr (von/bis) angeben." };
	}

	const fiscalYearFrom = new Date(fiscalYearFromRaw);
	const fiscalYearTo = new Date(fiscalYearToRaw);
	if (fiscalYearTo < fiscalYearFrom) {
		return { error: "Das Ende des Geschäftsjahres darf nicht vor dessen Beginn liegen." };
	}

	if (id) {
		const existing = requireDraftEconomicPlan(id);
		if ("error" in existing) return { error: existing.error };
	}

	const data = {
		hoaId,
		fiscalYearFrom: fiscalYearFrom.toISOString(),
		fiscalYearTo: fiscalYearTo.toISOString(),
		notes: notes || null,
	};

	try {
		if (id) {
			updateEconomicPlan(id, data);
			logActivity(user, "UPDATE", "wirtschaftsplan", `Wirtschaftsplan „${fiscalYearLabel(fiscalYearFrom, fiscalYearTo)}“ bearbeitet`, id);
		} else {
			const plan = createEconomicPlan(data);
			logActivity(user, "CREATE", "wirtschaftsplan", `Wirtschaftsplan „${fiscalYearLabel(fiscalYearFrom, fiscalYearTo)}“ angelegt`, plan.id);
		}
	} catch (error) {
		console.error("saveEconomicPlanAction failed", error);
		return { error: "Der Wirtschaftsplan konnte nicht gespeichert werden." };
	}

	revalidatePath(`/weg/wirtschaftsplan`);
	return { success: true };
}

export async function deleteEconomicPlanAction(id: string, _hoaId: string): Promise<ActionState> {
	const user = await requireUser();
	const existing = requireDraftEconomicPlan(id);
	if ("error" in existing) return { error: existing.error };

	try {
		deleteEconomicPlan(id);
	} catch (error) {
		console.error("deleteEconomicPlanAction failed", error);
		return { error: "Der Wirtschaftsplan konnte nicht gelöscht werden." };
	}

	logActivity(
		user,
		"DELETE",
		"wirtschaftsplan",
		`Wirtschaftsplan „${fiscalYearLabel(new Date(existing.plan.fiscalYearFrom), new Date(existing.plan.fiscalYearTo))}“ gelöscht`,
		id
	);

	revalidatePath(`/weg/wirtschaftsplan`);
	return { success: true };
}

// ============================================================
// Kostenpositionen (HoaCostItem, context = "PLAN")
// ============================================================

export async function saveEconomicPlanCostItemAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const id = getString(formData, "id");
	const economicPlanId = getString(formData, "economicPlanId");
	const categoryRaw = getString(formData, "category") as HoaCostCategory;
	const label = getString(formData, "label");
	const amount = getDecimalString(formData, "amount");
	const allocationKeyRaw = getString(formData, "allocationKey") as HoaAllocationKey;
	const directUnitId = getString(formData, "directUnitId");
	const customAllocationKeyId = getString(formData, "customAllocationKeyId");
	const notes = getString(formData, "notes");

	if (!economicPlanId || !label || amount === null || !allocationKeyRaw) {
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

	const existing = requireDraftEconomicPlan(economicPlanId);
	if ("error" in existing) return { error: existing.error };

	const data = {
		category,
		label,
		amount,
		allocationKey: allocationKeyRaw,
		directUnitId: allocationKeyRaw === "DIRECT" ? directUnitId : null,
		customAllocationKeyId: allocationKeyRaw === "CUSTOM" ? customAllocationKeyId : null,
		notes: notes || null,
	};

	try {
		if (id) {
			updateEconomicPlanCostItem(id, economicPlanId, data);
			logActivity(user, "UPDATE", "wirtschaftsplan", `Kostenposition „${label}“ bearbeitet`, id);
		} else {
			const costItem = createEconomicPlanCostItem(economicPlanId, data);
			logActivity(user, "CREATE", "wirtschaftsplan", `Kostenposition „${label}“ angelegt`, costItem.id);
		}
	} catch (error) {
		console.error("saveEconomicPlanCostItemAction failed", error);
		return { error: "Die Kostenposition konnte nicht gespeichert werden." };
	}

	revalidatePath(`/weg/wirtschaftsplan/${economicPlanId}`);
	return { success: true };
}

export async function deleteEconomicPlanCostItemAction(id: string, _hoaId: string, economicPlanId: string): Promise<ActionState> {
	const user = await requireUser();
	const existing = requireDraftEconomicPlan(economicPlanId);
	if ("error" in existing) return { error: existing.error };

	// Bezeichnung vor dem Löschen ermitteln (für den Log-Eintrag).
	const costItem = getHoaCostItem(id);
	try {
		deleteEconomicPlanCostItem(id);
	} catch (error) {
		console.error("deleteEconomicPlanCostItemAction failed", error);
		return { error: "Die Kostenposition konnte nicht gelöscht werden." };
	}

	logActivity(user, "DELETE", "wirtschaftsplan", `Kostenposition „${costItem ? costItem.label : id}“ gelöscht`, id);

	revalidatePath(`/weg/wirtschaftsplan/${economicPlanId}`);
	return { success: true };
}

// ============================================================
// Finalisierung: Entwurf -> Einzelwirtschaftsplan je Einheit
// ============================================================

export async function finalizeEconomicPlanAction(economicPlanId: string, _hoaId: string): Promise<ActionState> {
	const user = await requireUser();
	const detail = getEconomicPlanDetail(economicPlanId);

	if (!detail) {
		return { error: "Der Wirtschaftsplan wurde nicht gefunden." };
	}
	if (detail.plan.status !== "DRAFT") {
		return { error: "Dieser Wirtschaftsplan wurde bereits finalisiert." };
	}
	if (detail.costItems.length === 0) {
		return { error: "Bitte erfassen Sie mindestens eine Kostenposition, bevor Sie finalisieren." };
	}
	if (detail.units.length === 0) {
		return { error: "Diese Liegenschaft hat noch keine Einheiten." };
	}

	// Gewichte für "CUSTOM"-Kostenpositionen separat je Einheit auflösen.
	const customKeyIds = [...new Set(detail.costItems.map((costItem) => costItem.customAllocationKeyId).filter((keyId): keyId is string => keyId !== null))];
	const customWeights = listCustomAllocationKeyWeights(customKeyIds);
	const customWeightsByKey = new Map<string, { unitId: string; weight: number }[]>();
	for (const weight of customWeights) {
		const list = customWeightsByKey.get(weight.customAllocationKeyId) ?? [];
		list.push({ unitId: weight.unitId, weight: weight.weight });
		customWeightsByKey.set(weight.customAllocationKeyId, list);
	}

	const result = calculateEconomicPlanResult({
		fiscalYearFrom: new Date(detail.plan.fiscalYearFrom),
		fiscalYearTo: new Date(detail.plan.fiscalYearTo),
		units: detail.units.map((unit) => ({ id: unit.id, livingSpace: unit.livingSpace, coOwnershipShare: unit.coOwnershipShare })),
		costItems: detail.costItems.map((costItem) => ({
			id: costItem.id,
			amount: costItem.amount,
			allocationKey: costItem.allocationKey,
			directUnitId: costItem.directUnitId,
			customAllocationWeights: costItem.customAllocationKeyId ? customWeightsByKey.get(costItem.customAllocationKeyId) ?? [] : [],
		})),
	});

	// Läuft in EINER Transaktion: Löschen etwaiger Alt-Zeilen, Einfügen
	// der Einzelwirtschaftspläne und Statuswechsel sind atomar (siehe
	// src/data/economic-plans.ts).
	try {
		finalizeEconomicPlan(
			economicPlanId,
			result.unitShares.map((share) => ({ unitId: share.unitId, annualAmount: share.annualAmount, monthlyAmount: share.monthlyAmount }))
		);
	} catch (error) {
		console.error("finalizeEconomicPlanAction failed", error);
		return { error: "Der Wirtschaftsplan konnte nicht finalisiert werden." };
	}

	logActivity(
		user,
		"UPDATE",
		"wirtschaftsplan",
		`Wirtschaftsplan „${fiscalYearLabel(new Date(detail.plan.fiscalYearFrom), new Date(detail.plan.fiscalYearTo))}“ finalisiert`,
		economicPlanId
	);

	revalidatePath(`/weg/wirtschaftsplan/${economicPlanId}`);
	revalidatePath(`/weg/wirtschaftsplan`);
	return { success: true };
}

// ============================================================
// Monatliche Hausgeld-Sollstellungen aus dem finalisierten Wirtschaftsplan
// ============================================================

/**
 * Stellt für jeden Monat im Geschäftsjahr des Wirtschaftsplans und jede
 * Einheit das monatliche Hausgeld (aus economicPlanUnitShares) fällig -
 * analog zu generateDueTransactionsAction in
 * src/app/(app)/finanzen/actions.ts, aber auf Basis des bereits
 * eingefrorenen Einzelwirtschaftsplans statt einer erneuten Berechnung.
 * Der Eigentümer wird dabei je Fälligkeitsmonat anhand des zu diesem
 * Zeitpunkt gültigen Eigentumsverhältnisses ermittelt (unterjähriger
 * Wechsel wird berücksichtigt) - Monate ohne erfassten Eigentümer werden
 * übersprungen. Bereits vorhandene Sollstellungen für einen Monat werden
 * nicht doppelt angelegt (Button darf beliebig oft ausgeführt werden).
 */
export async function generateHousingChargesAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const economicPlanId = getString(formData, "economicPlanId");
	const dueDayRaw = getString(formData, "dueDay");

	const dueDay = Number(dueDayRaw);
	if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) {
		return { error: "Der Fälligkeitstag muss zwischen 1 und 28 liegen." };
	}

	const plan = getEconomicPlan(economicPlanId);
	if (!plan) {
		return { error: "Der Wirtschaftsplan wurde nicht gefunden." };
	}
	if (plan.status !== "FINALIZED") {
		return { error: "Hausgeld kann erst fällig gestellt werden, wenn der Wirtschaftsplan finalisiert wurde." };
	}

	const unitShares = listEconomicPlanUnitShares(economicPlanId);
	const ownershipsByUnit = new Map<string, { unitId: string; ownerId: string; startDate: string; endDate: string | null }[]>();
	for (const ownership of listUnitOwnershipsForUnits(unitShares.map((share) => share.unitId))) {
		const list = ownershipsByUnit.get(ownership.unitId) ?? [];
		list.push(ownership);
		ownershipsByUnit.set(ownership.unitId, list);
	}

	const fiscalYearFrom = new Date(plan.fiscalYearFrom);
	const fiscalYearTo = new Date(plan.fiscalYearTo);
	const startIndex = fiscalYearFrom.getFullYear() * 12 + fiscalYearFrom.getMonth();
	const endIndex = fiscalYearTo.getFullYear() * 12 + fiscalYearTo.getMonth();

	const candidates: DueHousingChargeCandidate[] = [];
	let skippedNoOwner = 0;

	for (const share of unitShares) {
		const ownerships = ownershipsByUnit.get(share.unitId) ?? [];

		for (let index = startIndex; index <= endIndex; index += 1) {
			const year = Math.floor(index / 12);
			const month = index % 12;
			const dueDate = new Date(year, month, dueDay);

			const ownership = findOwnershipForDate(ownerships, dueDate);
			if (!ownership) {
				skippedNoOwner += 1;
				continue;
			}

			const monthStart = new Date(year, month, 1);
			const monthEnd = new Date(year, month + 1, 1);

			candidates.push({
				unitId: share.unitId,
				ownerId: ownership.ownerId,
				economicPlanId,
				amount: share.monthlyAmount,
				dueDate: dueDate.toISOString(),
				purpose: `Hausgeld ${month + 1}/${year}`,
				monthStart: monthStart.toISOString(),
				monthEnd: monthEnd.toISOString(),
			});
		}
	}

	let created = 0;
	let skipped = 0;
	try {
		const result = generateHousingCharges(candidates);
		created = result.created;
		skipped = result.skipped;
	} catch (error) {
		console.error("generateHousingChargesAction failed", error);
		return { error: "Die Hausgeld-Sollstellungen konnten nicht angelegt werden." };
	}

	revalidatePath(`/weg/hausgeld`);
	revalidatePath(`/weg/wirtschaftsplan/${economicPlanId}`);

	if (created === 0) {
		return {
			success: true,
			message:
				skipped > 0
					? `Keine neuen Sollstellungen angelegt - für alle ${skipped} Einheit/Monat-Kombinationen existierten bereits Sollstellungen.`
					: skippedNoOwner > 0
						? "Für keine der Einheiten war zum jeweiligen Fälligkeitsmonat ein Eigentümer erfasst."
						: "Keine Einheiten mit Einzelwirtschaftsplan gefunden.",
		};
	}

	logActivity(user, "CREATE", "hausgeld", `Hausgeld fällig gestellt (${created} neue Position${created === 1 ? "" : "en"})`);

	return {
		success: true,
		message: `${created} Hausgeld-Sollstellung${created === 1 ? "" : "en"} angelegt${skipped > 0 ? ` (${skipped} bereits vorhanden)` : ""}${skippedNoOwner > 0 ? ` (${skippedNoOwner} ohne erfassten Eigentümer übersprungen)` : ""}.`,
	};
}
