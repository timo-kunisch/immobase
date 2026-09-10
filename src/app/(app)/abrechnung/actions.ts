"use server";

import { revalidatePath } from "next/cache";

import {
	createBillingPeriod,
	createCostItem,
	createCostItems,
	deleteBillingPeriodWithArtifacts,
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
import { listAccountBookingSumsForPeriod } from "@/data/accounts";
import { buildCustomAllocationWeightsByKey, createCustomAllocationKey, deleteCustomAllocationKey as deleteCustomAllocationKeyRow, getCustomAllocationKey, updateCustomAllocationKey, upsertCustomAllocationKeyWeight } from "@/data/custom-allocation-keys";
import { companySettingsToAddressLines, getCompanySettings } from "@/data/company-settings";
import type { AllocationKey } from "@/data/types";
import { requireUser } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { getT } from "@/lib/i18n/server";
import { ActionState } from "@/lib/action-state";
import { allocationKeyLabels, buildCostItemsFromAccountBookingSums, calculateBillingResult } from "@/lib/billing";
import { centsToDecimalString } from "@/lib/money";
import { generateBillingStatementPdf } from "@/lib/pdf/billing-statement";
import { deleteUploadedFile, saveGeneratedFile } from "@/lib/storage";
import { formatDate } from "@/lib/format";
import { getOptionalFloat } from "@/lib/form-data";
import { sendPdfByPostForSource, type PostalShipmentActionState } from "@/lib/postal-shipments";

const ALLOCATION_KEYS: AllocationKey[] = ["LIVING_SPACE", "OCCUPANTS", "UNITS", "CONSUMPTION", "DIRECT", "CUSTOM"];

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

/** Sprechende Bezeichnung einer Abrechnungsperiode für das Aktivitätsprotokoll. */
function billingPeriodLabel(period: { periodFrom: string; periodTo: string }): string {
	return `${formatDate(period.periodFrom)} – ${formatDate(period.periodTo)}`;
}

/** Lädt eine Abrechnungsperiode und prüft, dass sie noch im Entwurf ist. */
async function requireDraftBillingPeriod(billingPeriodId: string) {
	const t = await getT();
	const billingPeriod = getBillingPeriod(billingPeriodId);
	if (!billingPeriod) {
		return { error: t("billing.errors.periodNotFound") } as const;
	}
	if (billingPeriod.status !== "DRAFT") {
		return {
			error: t("billing.errors.periodFinalized"),
		} as const;
	}
	return { billingPeriod } as const;
}

// ============================================================
// Abrechnungsperiode (BillingPeriod)
// ============================================================

export async function saveBillingPeriodAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const id = getString(formData, "id");
	const propertyId = getString(formData, "propertyId");
	const periodFromRaw = getString(formData, "periodFrom");
	const periodToRaw = getString(formData, "periodTo");
	const notes = getString(formData, "notes");

	if (!propertyId || !periodFromRaw || !periodToRaw) {
		return {
			error: t("billing.errors.propertyAndPeriodRequired"),
		};
	}

	const periodFrom = new Date(periodFromRaw);
	const periodTo = new Date(periodToRaw);

	if (periodTo < periodFrom) {
		return { error: t("billing.errors.periodEndBeforeStart") };
	}

	if (id) {
		const existing = await requireDraftBillingPeriod(id);
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
			logActivity(user, "UPDATE", "abrechnung", `Abrechnungszeitraum „${billingPeriodLabel(data)}“ bearbeitet`, id);
		} else {
			const created = createBillingPeriod(data);
			logActivity(user, "CREATE", "abrechnung", `Abrechnungszeitraum „${billingPeriodLabel(data)}“ angelegt`, created.id);
		}
	} catch (error) {
		console.error("saveBillingPeriodAction failed", error);
		return { error: t("billing.errors.periodSaveFailed") };
	}

	revalidatePath("/abrechnung");
	return { success: true };
}

/**
 * Löscht eine Abrechnungsperiode - seit Wegfall der Löschsperre auch
 * FINALISIERTE Perioden (sie sind nicht mehr bearbeitbar, ihre Löschung
 * bleibt aber möglich, z. B. um fehlerhafte Abrechnungen zu entsorgen).
 * Mit ihr werden die Kostenpositionen, Verbrauchswerte, Einzelabrechnungen,
 * die erzeugten PDFs aus der Dateiablage sowie die Postversand-Protokolle
 * entfernt (atomar in der DB, siehe deleteBillingPeriodWithArtifacts).
 */
export async function deleteBillingPeriodAction(id: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const existing = getBillingPeriod(id);
	if (!existing) {
		return { error: t("billing.errors.periodNotFound") };
	}

	try {
		await deleteBillingPeriodWithArtifacts(id);
	} catch (error) {
		console.error("deleteBillingPeriodAction failed", error);
		return { error: t("billing.errors.periodDeleteFailed") };
	}

	logActivity(user, "DELETE", "abrechnung", `Abrechnungszeitraum „${billingPeriodLabel(existing)}“ gelöscht`, id);

	revalidatePath("/abrechnung");
	revalidatePath("/dokumente");
	return { success: true };
}

/**
 * Speichert ausschließlich die internen Notizen einer Abrechnungsperiode -
 * jederzeit erlaubt, auch nach der Finalisierung (die eigentlichen
 * Abrechnungsdaten - Zeitraum/Liegenschaft/Kostenpositionen - bleiben
 * gesperrt).
 */
export async function updateBillingPeriodNotesAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const id = getString(formData, "id");
	const notes = getString(formData, "notes");

	if (!id) {
		return { error: t("billing.errors.periodNotFound") };
	}

	const billingPeriod = getBillingPeriod(id);
	if (!billingPeriod) {
		return { error: t("billing.errors.periodNotFound") };
	}

	try {
		updateBillingPeriod(id, {
			propertyId: billingPeriod.propertyId,
			periodFrom: billingPeriod.periodFrom,
			periodTo: billingPeriod.periodTo,
			notes: notes || null,
		});
	} catch (error) {
		console.error("updateBillingPeriodNotesAction failed", error);
		return { error: t("billing.errors.periodSaveFailed") };
	}

	logActivity(user, "UPDATE", "abrechnung", `Notizen der Abrechnungsperiode „${billingPeriodLabel(billingPeriod)}“ aktualisiert`, id);

	revalidatePath("/abrechnung");
	revalidatePath(`/abrechnung/${id}`);
	return { success: true };
}

// ============================================================
// Kostenpositionen (CostItem)
// ============================================================

export async function saveCostItemAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const id = getString(formData, "id");
	const billingPeriodId = getString(formData, "billingPeriodId");
	const label = getString(formData, "label");
	const amount = getDecimalString(formData, "amount");
	const allocationKeyRaw = getString(formData, "allocationKey") as AllocationKey;
	const directUnitId = getString(formData, "directUnitId");
	const customAllocationKeyId = getString(formData, "customAllocationKeyId");
	const notes = getString(formData, "notes");

	if (!billingPeriodId || !label || amount === null || !allocationKeyRaw) {
		return {
			error: t("billing.errors.costItemFieldsRequired"),
		};
	}

	if (!ALLOCATION_KEYS.includes(allocationKeyRaw)) {
		return { error: t("billing.errors.invalidAllocationKey") };
	}

	if (allocationKeyRaw === "DIRECT" && !directUnitId) {
		return {
			error: t("billing.errors.directUnitRequired"),
		};
	}

	if (allocationKeyRaw === "CUSTOM" && !customAllocationKeyId) {
		return {
			error: t("billing.errors.customKeyRequired"),
		};
	}

	const existing = await requireDraftBillingPeriod(billingPeriodId);
	if ("error" in existing) return { error: existing.error };

	if (allocationKeyRaw === "CUSTOM" && customAllocationKeyId) {
		const customKey = getCustomAllocationKey(customAllocationKeyId);
		// Die Kostenposition wird mit dem Umlageschlüssel der Liegenschaft der
		// Abrechnungsperiode verrechnet - ein Schlüssel einer anderen
		// Liegenschaft wäre ein Datenfehler.
		if (!customKey || customKey.propertyId !== existing.billingPeriod.propertyId) {
			return { error: t("billing.errors.customKeyNotFound") };
		}
	}

	const data = {
		billingPeriodId,
		label,
		amount,
		allocationKey: allocationKeyRaw,
		directUnitId: allocationKeyRaw === "DIRECT" ? directUnitId : null,
		customAllocationKeyId: allocationKeyRaw === "CUSTOM" ? customAllocationKeyId : null,
		notes: notes || null,
	};

	try {
		if (id) {
			updateCostItem(id, data);
			logActivity(user, "UPDATE", "abrechnung", `Kostenposition „${label}“ bearbeitet`, id);
		} else {
			const created = createCostItem(data);
			logActivity(user, "CREATE", "abrechnung", `Kostenposition „${label}“ angelegt`, created.id);
		}
	} catch (error) {
		console.error("saveCostItemAction failed", error);
		return { error: t("billing.errors.costItemSaveFailed") };
	}

	revalidatePath("/abrechnung");
	return { success: true };
}

export async function deleteCostItemAction(id: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const costItem = getCostItem(id);
	if (!costItem) {
		return { error: t("billing.errors.costItemNotFound") };
	}
	const billingPeriod = getBillingPeriod(costItem.billingPeriodId);
	if (billingPeriod?.status !== "DRAFT") {
		return {
			error: t("billing.errors.periodFinalized"),
		};
	}

	try {
		deleteCostItem(id);
	} catch (error) {
		console.error("deleteCostItemAction failed", error);
		return { error: t("billing.errors.costItemDeleteFailed") };
	}

	logActivity(user, "DELETE", "abrechnung", `Kostenposition „${costItem.label}“ gelöscht`, id);

	revalidatePath("/abrechnung");
	return { success: true };
}

/**
 * Für den Sammel-Import sinnvolle Umlageschlüssel: DIRECT (je Position eine
 * Einheit) und CUSTOM (je Position ein individueller Schlüssel) erfordern
 * Einzelentscheidungen und bleiben dem Anlegen/Bearbeiten einzelner
 * Kostenpositionen vorbehalten.
 */
const BANKING_IMPORT_ALLOCATION_KEYS: AllocationKey[] = ["LIVING_SPACE", "OCCUPANTS", "UNITS", "CONSUMPTION"];

/**
 * Übernimmt die Buchungszeilen der Buchhaltung (siehe /buchhaltung) als
 * Kostenpositionen der Abrechnungsperiode: Je KONTO eine Position in Höhe
 * der Nettosumme seiner Buchungen im Abrechnungszeitraum (Gutschriften/
 * Erstattungen werden mit den Aufwendungen des Kontos verrechnet). Die
 * reine Umwandlungslogik liegt in src/lib/billing.ts
 * (buildCostItemsFromAccountBookingSums), das atomare Einfügen im
 * Repository (createCostItems).
 *
 * Buchungszeilen gegen Sollstellungen (Mieteingänge) sind ausgenommen: Sie
 * fließen über die bezahlt-Logik als geleistete Vorauszahlungen in die
 * Abrechnung (computePaidPrepaymentsCents in src/lib/billing.ts) und
 * dürfen nicht zusätzlich als Kosten auftauchen.
 */
export async function importCostItemsFromBankingAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const billingPeriodId = getString(formData, "billingPeriodId");
	const allocationKeyRaw = getString(formData, "allocationKey") as AllocationKey;

	if (!billingPeriodId) {
		return { error: t("billing.errors.periodNotFound") };
	}
	if (!BANKING_IMPORT_ALLOCATION_KEYS.includes(allocationKeyRaw)) {
		return { error: t("billing.errors.invalidAllocationKey") };
	}

	const existing = await requireDraftBillingPeriod(billingPeriodId);
	if ("error" in existing) return { error: existing.error };

	// Konto-Summen bewusst SERVERSEITIG neu ermitteln (autoritativ,
	// unabhängig von der ggf. veralteten Vorschau im Dialog).
	const accountSums = listAccountBookingSumsForPeriod(
		existing.billingPeriod.propertyId,
		existing.billingPeriod.periodFrom,
		existing.billingPeriod.periodTo
	);
	const items = buildCostItemsFromAccountBookingSums(accountSums, allocationKeyRaw);
	if (items.length === 0) {
		return { error: t("billing.errors.bankingImportNothingFound") };
	}

	try {
		createCostItems(
			items.map((item) => ({
				billingPeriodId,
				label: item.label,
				amount: item.amount,
				allocationKey: item.allocationKey,
				directUnitId: null,
				customAllocationKeyId: null,
				notes: item.notes,
			}))
		);
	} catch (error) {
		console.error("importCostItemsFromBankingAction failed", error);
		return { error: t("billing.errors.bankingImportFailed") };
	}

	logActivity(
		user,
		"CREATE",
		"abrechnung",
		`Kontobewegungen aus der Buchhaltung als ${items.length} Kostenposition${items.length === 1 ? "" : "en"} in den Abrechnungszeitraum „${billingPeriodLabel(existing.billingPeriod)}“ übernommen`,
		billingPeriodId
	);

	revalidatePath("/abrechnung");
	revalidatePath(`/abrechnung/${billingPeriodId}`);
	return {
		success: true,
		message: t(items.length === 1 ? "billing.success.bankingImport.one" : "billing.success.bankingImport.other", { count: items.length }),
	};
}

// ============================================================
// Verbrauchswerte (ConsumptionValue) je Einheit und Kostenposition
// ============================================================

export async function saveConsumptionValuesAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const costItemId = getString(formData, "costItemId");
	if (!costItemId) {
		return { error: t("billing.errors.invalidCostItem") };
	}

	const costItem = getCostItem(costItemId);
	if (!costItem) {
		return { error: t("billing.errors.costItemNotFound") };
	}
	const billingPeriod = getBillingPeriod(costItem.billingPeriodId);
	if (billingPeriod?.status !== "DRAFT") {
		return {
			error: t("billing.errors.periodFinalized"),
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
	// es kann kein teilweise gespeicherter Stand zurückbleiben.
	try {
		saveConsumptionValuesForCostItem(costItemId, values);
		logActivity(user, "UPDATE", "abrechnung", `Verbrauchswerte der Kostenposition „${costItem.label}“ aktualisiert`, costItemId);
	} catch (error) {
		console.error("saveConsumptionValuesAction failed", error);
		return { error: t("billing.errors.consumptionSaveFailed") };
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
	const user = await requireUser();
	const t = await getT();
	const detail = getBillingPeriodDetail(billingPeriodId);

	if (!detail) {
		return { error: t("billing.errors.periodNotFound") };
	}
	if (detail.billingPeriod.status !== "DRAFT") {
		return { error: t("billing.errors.periodAlreadyFinalized") };
	}
	if (detail.costItems.length === 0) {
		return {
			error: t("billing.errors.noCostItems"),
		};
	}

	// Gewichte der frei definierbaren Umlageschlüssel (allocationKey
	// "CUSTOM") in der Form auflösen, die die Berechnung erwartet - geteilter
	// Helfer des Repositories, identisch zur Live-Vorschau und zum
	// MCP-Finalisierungs-Werkzeug.
	const customWeightsByKey = buildCustomAllocationWeightsByKey(
		[...new Set(detail.costItems.map((costItem) => costItem.customAllocationKeyId).filter((keyId): keyId is string => keyId !== null))]
	);

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
			customAllocationWeights: costItem.customAllocationKeyId ? customWeightsByKey.get(costItem.customAllocationKeyId) ?? [] : [],
		})),
	});

	if (result.leaseResults.length === 0) {
		return {
			error: t("billing.errors.noLeases"),
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
		logActivity(user, "UPDATE", "abrechnung", `Abrechnungszeitraum „${billingPeriodLabel(detail.billingPeriod)}“ finalisiert`, billingPeriodId);
	} catch (error) {
		console.error("finalizeBillingPeriodAction failed", error);
		return {
			error: t("billing.errors.finalizeFailed"),
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
	const user = await requireUser();
	const t = await getT();
	const data = getTenantStatementForPdf(tenantStatementId);
	if (!data) {
		return { error: t("billing.errors.statementNotFound") };
	}

	try {
		const result = await buildAndSaveStatementPdf(data);
		if ("error" in result) return result;
		logActivity(user, "CREATE", "abrechnung", `Abrechnungs-PDF für „${data.tenant.firstName} ${data.tenant.lastName}“ erzeugt`, tenantStatementId);
	} catch (error) {
		console.error("generateBillingStatementPdfAction failed", error);
		return { error: t("billing.errors.pdfFailed") };
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
	const user = await requireUser();
	const t = await getT();
	const billingPeriod = getBillingPeriod(billingPeriodId);
	if (!billingPeriod) {
		return { error: t("billing.errors.periodNotFound") };
	}
	if (billingPeriod.status !== "FINALIZED") {
		return {
			error: t("billing.errors.pdfRequiresFinalized"),
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

	const generatedCount = statementIds.length - failedCount;
	if (generatedCount > 0) {
		logActivity(user, "CREATE", "abrechnung", `Abrechnungs-PDFs für Abrechnungszeitraum „${billingPeriodLabel(billingPeriod)}“ erzeugt (${generatedCount} Stück)`, billingPeriodId);
	}

	revalidatePath(`/abrechnung/${billingPeriodId}`);

	if (failedCount > 0) {
		return {
			error: t("billing.errors.somePdfsFailed", { failed: failedCount, total: statementIds.length }),
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
	const t = await getT();
	const data = getTenantStatementForPdf(tenantStatementId);
	if (!data) {
		return { error: t("billing.errors.statementNotFound") };
	}
	if (!data.statement.pdfPath) {
		return { error: t("billing.errors.pdfRequiredBeforePost") };
	}

	const result = await sendPdfByPostForSource("TENANT_STATEMENT", tenantStatementId, user.id, await getT());

	if ("success" in result) {
		logActivity(user, "CREATE", "postversand", `Abrechnung für „${data.tenant.firstName} ${data.tenant.lastName}“ per Post versendet`, tenantStatementId);
	}

	revalidatePath(`/abrechnung/${data.statement.billingPeriodId}`);
	return result;
}

// ============================================================
// Frei definierbare Umlageschlüssel (allocationKey "CUSTOM")
// ============================================================

export async function saveCustomAllocationKeyAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const id = getString(formData, "id");
	const propertyId = getString(formData, "propertyId");
	const label = getString(formData, "label");
	const notes = getString(formData, "notes");

	if (!propertyId || !label) {
		return { error: t("billing.allocationKeys.errors.requiredFields") };
	}

	try {
		if (id) {
			updateCustomAllocationKey(id, { label, notes: notes || null });
			logActivity(user, "UPDATE", "abrechnung", `Umlageschlüssel „${label}“ bearbeitet`, id);
		} else {
			const allocationKey = createCustomAllocationKey({ propertyId, label, notes: notes || null });
			logActivity(user, "CREATE", "abrechnung", `Umlageschlüssel „${label}“ angelegt`, allocationKey.id);
		}
	} catch (error) {
		console.error("saveCustomAllocationKeyAction failed", error);
		return { error: t("billing.allocationKeys.errors.saveFailed") };
	}

	revalidatePath("/abrechnung");
	return { success: true };
}

export async function deleteCustomAllocationKeyAction(id: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const allocationKey = getCustomAllocationKey(id);
	if (!allocationKey) {
		return { error: t("billing.allocationKeys.errors.notFound") };
	}

	try {
		deleteCustomAllocationKeyRow(id);
	} catch (error) {
		console.error("deleteCustomAllocationKeyAction failed", error);
		return { error: t("billing.allocationKeys.errors.deleteFailed") };
	}

	logActivity(user, "DELETE", "abrechnung", `Umlageschlüssel „${allocationKey.label}“ gelöscht`, id);

	revalidatePath("/abrechnung");
	return { success: true };
}

export async function saveCustomAllocationWeightsAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const customAllocationKeyId = getString(formData, "customAllocationKeyId");
	if (!customAllocationKeyId) {
		return { error: t("billing.allocationKeys.errors.invalidKey") };
	}

	const allocationKey = getCustomAllocationKey(customAllocationKeyId);
	if (!allocationKey) {
		return { error: t("billing.allocationKeys.errors.notFound") };
	}

	const unitIds: string[] = [];
	for (const key of formData.keys()) {
		const match = /^weight-(.+)$/.exec(key);
		if (match) unitIds.push(match[1]);
	}

	// Bewusst sequenzielle Einzel-Upserts (Muster wie saveConsumptionValuesAction).
	try {
		for (const unitId of unitIds) {
			const weight = getOptionalFloat(formData, `weight-${unitId}`) ?? 0;
			upsertCustomAllocationKeyWeight(customAllocationKeyId, unitId, weight);
		}
		logActivity(user, "UPDATE", "abrechnung", `Gewichte des Umlageschlüssels „${allocationKey.label}“ aktualisiert`, customAllocationKeyId);
	} catch (error) {
		console.error("saveCustomAllocationWeightsAction failed", error);
		return { error: t("billing.allocationKeys.errors.weightsSaveFailed") };
	}

	revalidatePath("/abrechnung");
	return { success: true };
}
