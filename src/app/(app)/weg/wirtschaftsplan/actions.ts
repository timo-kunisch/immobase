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
import { getT } from "@/lib/i18n/server";
import type { HoaAllocationKey } from "@/data/types";

const HOA_ALLOCATION_KEYS: HoaAllocationKey[] = ["MEA", "LIVING_SPACE", "UNITS", "DIRECT", "CUSTOM"];

/** Lädt einen Wirtschaftsplan und prüft, dass er noch im Entwurf ist. */
async function requireDraftEconomicPlan(economicPlanId: string) {
	const t = await getT();
	const plan = getEconomicPlan(economicPlanId);
	if (!plan) {
		return { error: t("hoaPlan.errors.notFound") } as const;
	}
	if (plan.status !== "DRAFT") {
		return { error: t("hoaPlan.errors.alreadyFinalized") } as const;
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
	const t = await getT();
	const id = getString(formData, "id");
	const hoaId = getString(formData, "hoaId");
	const fiscalYearFromRaw = getString(formData, "fiscalYearFrom");
	const fiscalYearToRaw = getString(formData, "fiscalYearTo");
	const notes = getString(formData, "notes");

	if (!hoaId || !fiscalYearFromRaw || !fiscalYearToRaw) {
		return { error: t("hoaPlan.errors.fiscalYearRequired") };
	}

	const fiscalYearFrom = new Date(fiscalYearFromRaw);
	const fiscalYearTo = new Date(fiscalYearToRaw);
	if (fiscalYearTo < fiscalYearFrom) {
		return { error: t("hoaPlan.errors.fiscalYearOrder") };
	}

	if (id) {
		const existing = await requireDraftEconomicPlan(id);
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
		return { error: t("hoaPlan.errors.saveFailed") };
	}

	revalidatePath(`/weg/wirtschaftsplan`);
	return { success: true };
}

export async function deleteEconomicPlanAction(id: string, _hoaId: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const existing = await requireDraftEconomicPlan(id);
	if ("error" in existing) return { error: existing.error };

	try {
		deleteEconomicPlan(id);
	} catch (error) {
		console.error("deleteEconomicPlanAction failed", error);
		return { error: t("hoaPlan.errors.deleteFailed") };
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
	const t = await getT();
	const id = getString(formData, "id");
	const economicPlanId = getString(formData, "economicPlanId");
	const label = getString(formData, "label");
	const amount = getDecimalString(formData, "amount");
	const allocationKeyRaw = getString(formData, "allocationKey") as HoaAllocationKey;
	const directUnitId = getString(formData, "directUnitId");
	const customAllocationKeyId = getString(formData, "customAllocationKeyId");
	const notes = getString(formData, "notes");

	if (!economicPlanId || !label || amount === null || !allocationKeyRaw) {
		return { error: t("hoaPlan.errors.costItemRequired") };
	}

	if (!HOA_ALLOCATION_KEYS.includes(allocationKeyRaw)) {
		return { error: t("hoaPlan.errors.invalidAllocationKey") };
	}
	if (allocationKeyRaw === "DIRECT" && !directUnitId) {
		return { error: t("hoaPlan.errors.directUnitRequired") };
	}
	if (allocationKeyRaw === "CUSTOM" && !customAllocationKeyId) {
		return { error: t("hoaPlan.errors.customKeyRequired") };
	}

	const existing = await requireDraftEconomicPlan(economicPlanId);
	if ("error" in existing) return { error: existing.error };

	const data = {
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
		return { error: t("hoaPlan.errors.costItemSaveFailed") };
	}

	revalidatePath(`/weg/wirtschaftsplan/${economicPlanId}`);
	return { success: true };
}

export async function deleteEconomicPlanCostItemAction(id: string, _hoaId: string, economicPlanId: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const existing = await requireDraftEconomicPlan(economicPlanId);
	if ("error" in existing) return { error: existing.error };

	// Bezeichnung vor dem Löschen ermitteln (für den Log-Eintrag).
	const costItem = getHoaCostItem(id);
	try {
		deleteEconomicPlanCostItem(id);
	} catch (error) {
		console.error("deleteEconomicPlanCostItemAction failed", error);
		return { error: t("hoaPlan.errors.costItemDeleteFailed") };
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
	const t = await getT();
	const detail = getEconomicPlanDetail(economicPlanId);

	if (!detail) {
		return { error: t("hoaPlan.errors.notFound") };
	}
	if (detail.plan.status !== "DRAFT") {
		return { error: t("hoaPlan.errors.alreadyFinalizedShort") };
	}
	if (detail.costItems.length === 0) {
		return { error: t("hoaPlan.errors.noCostItems") };
	}
	if (detail.units.length === 0) {
		return { error: t("hoaPlan.errors.noUnits") };
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
		return { error: t("hoaPlan.errors.finalizeFailed") };
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
	const t = await getT();
	const economicPlanId = getString(formData, "economicPlanId");
	const dueDayRaw = getString(formData, "dueDay");

	const dueDay = Number(dueDayRaw);
	if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) {
		return { error: t("hoaPlan.errors.dueDayRange") };
	}

	const plan = getEconomicPlan(economicPlanId);
	if (!plan) {
		return { error: t("hoaPlan.errors.notFound") };
	}
	if (plan.status !== "FINALIZED") {
		return { error: t("hoaPlan.errors.chargesRequireFinalized") };
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
		return { error: t("hoaPlan.errors.chargesFailed") };
	}

	revalidatePath(`/weg/hausgeld`);
	revalidatePath(`/weg/wirtschaftsplan/${economicPlanId}`);

	if (created === 0) {
		return {
			success: true,
			message:
				skipped > 0
					? t("hoaPlan.success.chargesNoneExisting", { skipped })
					: skippedNoOwner > 0
						? t("hoaPlan.success.chargesNoneNoOwner")
						: t("hoaPlan.success.chargesNoneNoShares"),
		};
	}

	logActivity(user, "CREATE", "hausgeld", `Hausgeld fällig gestellt (${created} neue Position${created === 1 ? "" : "en"})`);

	return {
		success: true,
		message: `${t(created === 1 ? "hoaPlan.success.chargesCreated.one" : "hoaPlan.success.chargesCreated.other", { created })}${skipped > 0 ? ` (${t("hoaPlan.success.chargesExistingHint", { skipped })})` : ""}${skippedNoOwner > 0 ? ` (${t("hoaPlan.success.chargesNoOwnerHint", { skippedNoOwner })})` : ""}.`,
	};
}
