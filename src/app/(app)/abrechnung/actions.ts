"use server";

import { revalidatePath } from "next/cache";

import {
	createBillingPeriod,
	createCostItem,
	deleteBillingPeriod,
	deleteCostItem,
	finalizeBillingPeriod,
	getBillingPeriod,
	getBillingPeriodDetail,
	getCostItem,
	getTenantStatementForPdf,
	listTenantStatementIdsForPeriod,
	saveConsumptionValuesForCostItem,
	updateBillingPeriod,
	updateCostItem,
	updateTenantStatementPdf,
	type TenantStatementPdfData,
} from "@/data/billing";
import { companySettingsToAddressLines, getCompanySettings } from "@/data/company-settings";
import type { AllocationKey, CostCategory } from "@/data/types";
import { requireUser } from "@/lib/auth/dal";
import { ActionState } from "@/lib/action-state";
import { allocationKeyLabels, calculateBillingResult, costCategoryLabels } from "@/lib/billing";
import { centsToDecimalString } from "@/lib/money";
import { generateBillingStatementPdf } from "@/lib/pdf/billing-statement";
import { deleteUploadedFile, saveGeneratedFile } from "@/lib/storage";
import { formatDate } from "@/lib/format";
import { sendPdfByPostForSource, type PostalShipmentActionState } from "@/lib/postal-shipments";

const COST_CATEGORIES: CostCategory[] = [
	"PUBLIC_CHARGES",
	"WATER_SUPPLY",
	"DRAINAGE",
	"HEATING",
	"HOT_WATER",
	"HEATING_HOT_WATER_COMBINED",
	"ELEVATOR",
	"STREET_CLEANING_WASTE",
	"BUILDING_CLEANING_PEST_CONTROL",
	"GARDEN_MAINTENANCE",
	"LIGHTING",
	"CHIMNEY_CLEANING",
	"INSURANCE",
	"CARETAKER",
	"CABLE_ANTENNA",
	"LAUNDRY_FACILITIES",
	"OTHER",
];
const ALLOCATION_KEYS: AllocationKey[] = ["LIVING_SPACE", "OCCUPANTS", "UNITS", "CONSUMPTION", "DIRECT"];

function getString(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === "string" ? value.trim() : "";
}

function getDecimalString(formData: FormData, key: string): string | null {
	const raw = getString(formData, key).replace(",", ".");
	if (!raw) return null;
	const parsed = Number(raw);
	return Number.isNaN(parsed) ? null : parsed.toFixed(2);
}

/** Lädt eine Abrechnungsperiode und prüft, dass sie noch im Entwurf ist. */
function requireDraftBillingPeriod(billingPeriodId: string) {
	const billingPeriod = getBillingPeriod(billingPeriodId);
	if (!billingPeriod) {
		return { error: "Die Abrechnungsperiode wurde nicht gefunden." } as const;
	}
	if (billingPeriod.status !== "DRAFT") {
		return {
			error: "Diese Abrechnungsperiode ist bereits finalisiert und kann nicht mehr geändert werden.",
		} as const;
	}
	return { billingPeriod } as const;
}

// ============================================================
// Abrechnungsperiode (BillingPeriod)
// ============================================================

export async function saveBillingPeriodAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	const id = getString(formData, "id");
	const propertyId = getString(formData, "propertyId");
	const periodFromRaw = getString(formData, "periodFrom");
	const periodToRaw = getString(formData, "periodTo");
	const notes = getString(formData, "notes");

	if (!propertyId || !periodFromRaw || !periodToRaw) {
		return {
			error: "Bitte Liegenschaft sowie Zeitraum (von/bis) angeben.",
		};
	}

	const periodFrom = new Date(periodFromRaw);
	const periodTo = new Date(periodToRaw);

	if (periodTo < periodFrom) {
		return { error: "Das Ende des Zeitraums darf nicht vor dem Beginn liegen." };
	}

	if (id) {
		const existing = requireDraftBillingPeriod(id);
		if ("error" in existing) return { error: existing.error };
	}

	const data = {
		propertyId,
		periodFrom: periodFrom.toISOString(),
		periodTo: periodTo.toISOString(),
		notes: notes || null,
	};

	try {
		if (id) {
			updateBillingPeriod(id, data);
		} else {
			createBillingPeriod(data);
		}
	} catch (error) {
		console.error("saveBillingPeriodAction failed", error);
		return { error: "Die Abrechnungsperiode konnte nicht gespeichert werden." };
	}

	revalidatePath("/abrechnung");
	return { success: true };
}

export async function deleteBillingPeriodAction(id: string): Promise<ActionState> {
	await requireUser();
	const existing = requireDraftBillingPeriod(id);
	if ("error" in existing) return { error: existing.error };

	try {
		deleteBillingPeriod(id);
	} catch (error) {
		console.error("deleteBillingPeriodAction failed", error);
		return { error: "Die Abrechnungsperiode konnte nicht gelöscht werden." };
	}

	revalidatePath("/abrechnung");
	return { success: true };
}

// ============================================================
// Kostenpositionen (CostItem) nach § 2 BetrKV
// ============================================================

export async function saveCostItemAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	const id = getString(formData, "id");
	const billingPeriodId = getString(formData, "billingPeriodId");
	const categoryRaw = getString(formData, "category") as CostCategory;
	const label = getString(formData, "label");
	const amount = getDecimalString(formData, "amount");
	const allocationKeyRaw = getString(formData, "allocationKey") as AllocationKey;
	const directUnitId = getString(formData, "directUnitId");
	const notes = getString(formData, "notes");

	if (!billingPeriodId || !label || amount === null || !allocationKeyRaw) {
		return {
			error: "Bitte Bezeichnung, Betrag und Umlageschlüssel für die Kostenposition angeben.",
		};
	}

	const category: CostCategory = COST_CATEGORIES.includes(categoryRaw) ? categoryRaw : "OTHER";

	if (!ALLOCATION_KEYS.includes(allocationKeyRaw)) {
		return { error: "Ungültiger Umlageschlüssel." };
	}

	if (allocationKeyRaw === "DIRECT" && !directUnitId) {
		return {
			error: "Bei direkter Zuordnung muss eine Einheit ausgewählt werden.",
		};
	}

	const existing = requireDraftBillingPeriod(billingPeriodId);
	if ("error" in existing) return { error: existing.error };

	const data = {
		billingPeriodId,
		category,
		label,
		amount,
		allocationKey: allocationKeyRaw,
		directUnitId: allocationKeyRaw === "DIRECT" ? directUnitId : null,
		notes: notes || null,
	};

	try {
		if (id) {
			updateCostItem(id, data);
		} else {
			createCostItem(data);
		}
	} catch (error) {
		console.error("saveCostItemAction failed", error);
		return { error: "Die Kostenposition konnte nicht gespeichert werden." };
	}

	revalidatePath("/abrechnung");
	return { success: true };
}

export async function deleteCostItemAction(id: string): Promise<ActionState> {
	await requireUser();
	const costItem = getCostItem(id);
	if (!costItem) {
		return { error: "Die Kostenposition wurde nicht gefunden." };
	}
	const billingPeriod = getBillingPeriod(costItem.billingPeriodId);
	if (billingPeriod?.status !== "DRAFT") {
		return {
			error: "Diese Abrechnungsperiode ist bereits finalisiert und kann nicht mehr geändert werden.",
		};
	}

	try {
		deleteCostItem(id);
	} catch (error) {
		console.error("deleteCostItemAction failed", error);
		return { error: "Die Kostenposition konnte nicht gelöscht werden." };
	}

	revalidatePath("/abrechnung");
	return { success: true };
}

// ============================================================
// Verbrauchswerte (ConsumptionValue) je Einheit und Kostenposition
// ============================================================

export async function saveConsumptionValuesAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	const costItemId = getString(formData, "costItemId");
	if (!costItemId) {
		return { error: "Ungültige Kostenposition." };
	}

	const costItem = getCostItem(costItemId);
	if (!costItem) {
		return { error: "Die Kostenposition wurde nicht gefunden." };
	}
	const billingPeriod = getBillingPeriod(costItem.billingPeriodId);
	if (billingPeriod?.status !== "DRAFT") {
		return {
			error: "Diese Abrechnungsperiode ist bereits finalisiert und kann nicht mehr geändert werden.",
		};
	}

	const values: { unitId: string; value: string }[] = [];
	for (const key of formData.keys()) {
		const match = /^value-(.+)$/.exec(key);
		if (!match) continue;
		const raw = getString(formData, `value-${match[1]}`).replace(",", ".");
		const parsed = raw ? Number(raw) : 0;
		values.push({ unitId: match[1], value: Number.isNaN(parsed) ? "0" : parsed.toFixed(3) });
	}

	// Das Speichern läuft transaktional im Repository (src/data/billing.ts) -
	// anders als unter D1 kann hier kein teilweise gespeicherter Stand
	// zurückbleiben.
	try {
		saveConsumptionValuesForCostItem(costItemId, values);
	} catch (error) {
		console.error("saveConsumptionValuesAction failed", error);
		return { error: "Die Verbrauchswerte konnten nicht gespeichert werden." };
	}

	revalidatePath("/abrechnung");
	return { success: true };
}

// ============================================================
// Finalisierung: Entwurf -> unveränderliches Ergebnis
// ============================================================

/**
 * Berechnet die vollständige Kostenumlage für eine Abrechnungsperiode und
 * friert das Ergebnis dauerhaft als TenantStatement/TenantStatementLine ein.
 * Ab diesem Zeitpunkt ist die Periode (inkl. ihrer Kostenpositionen und
 * Verbrauchswerte) unveränderlich - spätere Datenänderungen (z. B. eine neue
 * Mieterhöhung) dürfen dieses historische Ergebnis nicht mehr verändern.
 *
 * Die Berechnung bleibt in src/lib/billing.ts (reine Funktion); das
 * Einfrieren (vorherige Statements ersetzen + Status setzen) läuft atomar
 * in einer Transaktion im Repository (src/data/billing.ts).
 */
export async function finalizeBillingPeriodAction(billingPeriodId: string): Promise<ActionState> {
	await requireUser();
	const detail = getBillingPeriodDetail(billingPeriodId);

	if (!detail) {
		return { error: "Die Abrechnungsperiode wurde nicht gefunden." };
	}
	if (detail.billingPeriod.status !== "DRAFT") {
		return { error: "Diese Abrechnungsperiode wurde bereits finalisiert." };
	}
	if (detail.costItems.length === 0) {
		return {
			error: "Bitte erfassen Sie mindestens eine Kostenposition, bevor Sie finalisieren.",
		};
	}

	const result = calculateBillingResult({
		periodFrom: new Date(detail.billingPeriod.periodFrom),
		periodTo: new Date(detail.billingPeriod.periodTo),
		units: detail.units.map((unit) => ({
			id: unit.id,
			livingSpace: unit.livingSpace,
			leases: unit.leases,
		})),
		costItems: detail.costItems.map((costItem) => ({
			id: costItem.id,
			amount: costItem.amount,
			allocationKey: costItem.allocationKey,
			directUnitId: costItem.directUnitId,
			consumptionValues: costItem.consumptionValues,
		})),
	});

	if (result.leaseResults.length === 0) {
		return {
			error: "Für den gewählten Zeitraum wurden keine Mietverhältnisse gefunden, die abgerechnet werden könnten.",
		};
	}

	try {
		finalizeBillingPeriod(
			billingPeriodId,
			result.leaseResults.map((leaseResult) => ({
				leaseId: leaseResult.leaseId,
				occupiedFrom: leaseResult.occupiedFrom.toISOString(),
				occupiedTo: leaseResult.occupiedTo.toISOString(),
				occupiedDays: leaseResult.occupiedDays,
				totalAllocatedCosts: centsToDecimalString(leaseResult.totalAllocatedCostsCents),
				totalPrepayments: centsToDecimalString(leaseResult.totalPrepaymentsCents),
				balance: centsToDecimalString(leaseResult.balanceCents),
				lines: leaseResult.lines.map((line) => ({
					costItemId: line.costItemId,
					amount: centsToDecimalString(line.amountCents),
				})),
			}))
		);
	} catch (error) {
		console.error("finalizeBillingPeriodAction failed", error);
		return {
			error: "Die Abrechnung konnte nicht finalisiert werden.",
		};
	}

	revalidatePath("/abrechnung");
	revalidatePath("/finanzen");
	return { success: true };
}

// ============================================================
// PDF-Erzeugung: versandfertige Abrechnung je Mietverhältnis
// ============================================================
//
// Nutzt ausschließlich die beim Finalisieren bereits berechneten und
// dauerhaft eingefrorenen TenantStatement/TenantStatementLine-Datensätze
// als Datenquelle (keine erneute Berechnung, keine Duplizierung der Logik
// aus src/lib/billing.ts) - ein PDF kann daher nur für finalisierte
// Perioden erzeugt werden, nicht für Entwürfe.

async function buildAndSaveStatementPdf(data: TenantStatementPdfData): Promise<ActionState> {
	const settings = getCompanySettings();
	const senderLines = companySettingsToAddressLines(settings);

	const pdfBuffer = await generateBillingStatementPdf({
		senderLines,
		senderAdditional: settings.additional,
		recipientLines: [
			`${data.tenant.firstName} ${data.tenant.lastName}`,
			data.unitProperty.street,
			`${data.unitProperty.zipCode} ${data.unitProperty.city}`,
		],
		dateLine: formatDate(new Date()),
		propertyName: data.property.name,
		periodFrom: new Date(data.billingPeriod.periodFrom),
		periodTo: new Date(data.billingPeriod.periodTo),
		occupiedFrom: new Date(data.statement.occupiedFrom),
		occupiedTo: new Date(data.statement.occupiedTo),
		occupiedDays: data.statement.occupiedDays,
		lines: data.lines.map((line) => ({
			label: line.costItem.label,
			categoryLabel: costCategoryLabels[line.costItem.category],
			totalAmount: line.costItem.amount,
			allocationKeyLabel: allocationKeyLabels[line.costItem.allocationKey],
			tenantShare: line.amount,
		})),
		totalAllocatedCosts: data.statement.totalAllocatedCosts,
		totalPrepayments: data.statement.totalPrepayments,
		balance: data.statement.balance,
	});

	const fileName = `Nebenkostenabrechnung ${data.property.name} ${data.tenant.lastName}.pdf`;
	const saved = await saveGeneratedFile(pdfBuffer, "billing-statements", fileName);

	const previousPdfPath = data.statement.pdfPath;

	updateTenantStatementPdf(data.statement.id, {
		pdfPath: saved.relativePath,
		pdfFileSize: saved.fileSize,
		pdfGeneratedAt: new Date().toISOString(),
	});

	// Ein zuvor erzeugtes PDF (z. B. mit veralteten Absenderdaten) wird durch
	// das neue ersetzt - die alte Datei danach aus der Dateiablage löschen.
	if (previousPdfPath && previousPdfPath !== saved.relativePath) {
		await deleteUploadedFile(previousPdfPath);
	}

	return { success: true };
}

/**
 * Erzeugt (bzw. erneuert) das versandfertige PDF für ein einzelnes
 * TenantStatement. Erlaubt erneutes Erzeugen (z. B. nach Korrektur der
 * Absenderdaten unter /einstellungen) - ersetzt ein zuvor erzeugtes PDF.
 */
export async function generateBillingStatementPdfAction(tenantStatementId: string): Promise<ActionState> {
	await requireUser();
	const data = getTenantStatementForPdf(tenantStatementId);
	if (!data) {
		return { error: "Die Abrechnung wurde nicht gefunden." };
	}

	try {
		const result = await buildAndSaveStatementPdf(data);
		if ("error" in result) return result;
	} catch (error) {
		console.error("generateBillingStatementPdfAction failed", error);
		return { error: "Das PDF konnte nicht erzeugt werden." };
	}

	revalidatePath(`/abrechnung/${data.statement.billingPeriodId}`);
	return { success: true };
}

/**
 * Erzeugt in einem Zug die PDFs für alle TenantStatements einer
 * Abrechnungsperiode (z. B. für den anschließenden Massenversand).
 * Bereits erzeugte PDFs werden dabei erneuert (siehe
 * generateBillingStatementPdfAction).
 */
export async function generateAllBillingStatementPdfsAction(billingPeriodId: string): Promise<ActionState> {
	await requireUser();
	const billingPeriod = getBillingPeriod(billingPeriodId);
	if (!billingPeriod) {
		return { error: "Die Abrechnungsperiode wurde nicht gefunden." };
	}
	if (billingPeriod.status !== "FINALIZED") {
		return {
			error: "PDFs können erst erzeugt werden, wenn die Abrechnungsperiode finalisiert wurde.",
		};
	}

	const statementIds = listTenantStatementIdsForPeriod(billingPeriodId);

	let failedCount = 0;
	for (const id of statementIds) {
		const data = getTenantStatementForPdf(id);
		if (!data) {
			failedCount += 1;
			continue;
		}
		try {
			await buildAndSaveStatementPdf(data);
		} catch (error) {
			console.error(`generateAllBillingStatementPdfsAction: PDF für TenantStatement ${id} fehlgeschlagen`, error);
			failedCount += 1;
		}
	}

	revalidatePath(`/abrechnung/${billingPeriodId}`);

	if (failedCount > 0) {
		return {
			error: `${failedCount} von ${statementIds.length} PDFs konnten nicht erzeugt werden.`,
		};
	}

	return { success: true };
}

// ============================================================
// Postversand: versandfertiges Abrechnungs-PDF per LetterXpress verschicken
// ============================================================

/**
 * Verschickt das bereits erzeugte PDF eines TenantStatements per Post
 * (LetterXpress API, siehe src/lib/letterxpress.ts). Setzt voraus, dass
 * zuvor bereits ein PDF erzeugt wurde (generateBillingStatementPdfAction) -
 * ohne pdfPath gibt es nichts zu versenden.
 */
export async function sendStatementByPostAction(tenantStatementId: string): Promise<PostalShipmentActionState> {
	const user = await requireUser();
	const data = getTenantStatementForPdf(tenantStatementId);
	if (!data) {
		return { error: "Die Abrechnung wurde nicht gefunden." };
	}
	if (!data.statement.pdfPath) {
		return { error: "Bitte erzeugen Sie zunächst das PDF, bevor Sie es per Post versenden." };
	}

	const result = await sendPdfByPostForSource("TENANT_STATEMENT", tenantStatementId, user.id);

	revalidatePath(`/abrechnung/${data.statement.billingPeriodId}`);
	return result;
}
