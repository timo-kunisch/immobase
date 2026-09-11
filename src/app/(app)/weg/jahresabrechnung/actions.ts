"use server";

import { revalidatePath } from "next/cache";

import {
	createAnnualStatement,
	createHoaCostItem,
	createHoaCostItems,
	deleteAnnualStatementWithArtifacts,
	deleteHoaCostItem,
	finalizeAnnualStatement,
	getAnnualStatement,
	getAnnualStatementDetail,
	getAnnualStatementUnitResultForBridge,
	getAnnualStatementUnitResultForPdf,
	getHoaCostItem,
	listAnnualStatementUnitResultIds,
	listCustomAllocationKeyWeights,
	listHousingChargesForUnits,
	saveHoaConsumptionValuesForCostItem,
	updateAnnualStatement,
	updateAnnualStatementUnitResultPdf,
	updateHoaCostItem,
} from "@/data/annual-statements";
import { listAccountBookingSumsForPeriod } from "@/data/accounts";
import { createCostItem, getBillingPeriod } from "@/data/billing";
import { companySettingsToAddressLines, getCompanySettings } from "@/data/company-settings";
import type { HoaAllocationKey } from "@/data/types";
import { requireUser } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { ActionState } from "@/lib/action-state";
import { getString, getDecimalString } from "@/lib/form-data";
import { calculateAnnualStatementResult, hoaAllocationKeyLabels } from "@/lib/hoa-annual-statement";
import { getT } from "@/lib/i18n/server";
import { centsToDecimalString } from "@/lib/money";
import { buildBetrKvCostItemsFromHoaStatement } from "@/lib/hoa-betrkv-bridge";
import { buildCostItemsFromAccountBookingSums } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import { generateHoaAnnualStatementPdf } from "@/lib/pdf/hoa-annual-statement";
import { deleteUploadedFile, saveGeneratedFile } from "@/lib/storage";
import { sendPdfByPostForSource, type PostalShipmentActionState } from "@/lib/postal-shipments";

const HOA_ALLOCATION_KEYS: HoaAllocationKey[] = ["MEA", "LIVING_SPACE", "UNITS", "CONSUMPTION", "DIRECT", "CUSTOM"];

/**
 * Für den Sammel-Import sinnvolle Verteilerschlüssel: DIRECT (je Position
 * eine Einheit) und CUSTOM (je Position ein individueller Schlüssel)
 * erfordern Einzelentscheidungen und bleiben dem Anlegen/Bearbeiten
 * einzelner Kostenpositionen vorbehalten.
 */
const BANKING_IMPORT_ALLOCATION_KEYS: HoaAllocationKey[] = ["MEA", "LIVING_SPACE", "UNITS", "CONSUMPTION"];

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

/**
 * Speichert NUR die Notizen einer Jahresabrechnung - bewusst jederzeit
 * möglich, auch nach der Finalisierung (Notizen sind interne Anmerkungen,
 * keine Abrechnungsdaten; Zeitraum/Kostenpositionen bleiben gesperrt).
 * Muster: updateBillingPeriodNotesAction in der Mietverwaltung.
 */
export async function updateAnnualStatementNotesAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const id = getString(formData, "id");
	const notes = getString(formData, "notes");

	if (!id) {
		return { error: t("hoaStatement.errors.notFound") };
	}

	const existing = getAnnualStatement(id);
	if (!existing) {
		return { error: t("hoaStatement.errors.notFound") };
	}

	// WEG/Stammfelder aus dem bestehenden Datensatz durchreichen - nur die
	// Notizen ändern sich.
	updateAnnualStatement(id, {
		hoaId: existing.hoaId,
		periodFrom: existing.periodFrom,
		periodTo: existing.periodTo,
		notes: notes || null,
	});
	logActivity(user, "UPDATE", "jahresabrechnung", `Notizen der Jahresabrechnung „${periodLabel(new Date(existing.periodFrom), new Date(existing.periodTo))}“ aktualisiert`, id);

	revalidatePath(`/weg/jahresabrechnung`);
	revalidatePath(`/weg/jahresabrechnung/${id}`);
	return { success: true };
}

/**
 * Löscht eine Jahresabrechnung (Entwurf ODER finalisiert) inkl. aller
 * erzeugten Artefakte: Abrechnungs-PDFs aus der Dateiablage,
 * Postversand-Protokolle sowie die Abrechnung selbst
 * (deleteAnnualStatementWithArtifacts) - Muster:
 * deleteBillingPeriodAction in der Mietverwaltung.
 */
export async function deleteAnnualStatementAction(id: string, _hoaId: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const existing = getAnnualStatement(id);
	if (!existing) {
		return { error: t("hoaStatement.errors.notFound") };
	}

	try {
		await deleteAnnualStatementWithArtifacts(id);
	} catch (error) {
		console.error("deleteAnnualStatementAction failed", error);
		return { error: t("hoaStatement.errors.deleteFailed") };
	}

	logActivity(
		user,
		"DELETE",
		"jahresabrechnung",
		`Jahresabrechnung „${periodLabel(new Date(existing.periodFrom), new Date(existing.periodTo))}“ gelöscht`,
		id
	);

	revalidatePath(`/weg/jahresabrechnung`);
	revalidatePath(`/dokumente`);
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

/**
 * Übernimmt die Buchungszeilen der Buchhaltung (siehe /weg/buchhaltung) als
 * Kostenpositionen der Jahresabrechnung: Je KONTO eine Position in Höhe
 * der Nettosumme seiner Buchungen im Abrechnungszeitraum (Gutschriften/
 * Erstattungen werden mit den Aufwendungen des Kontos verrechnet). Die
 * reine Umwandlungslogik liegt GETEILT in src/lib/billing.ts
 * (buildCostItemsFromAccountBookingSums), das atomare Einfügen im
 * Repository (createHoaCostItems) - Muster:
 * importCostItemsFromBankingAction in der Mietverwaltung.
 *
 * Buchungszeilen gegen Hausgeld-Sollstellungen sind ausgenommen: Sie
 * fließen über die bezahlt-Logik als geleistete Vorauszahlungen in die
 * Abrechnung (calculatePaidPrepaymentsCents in
 * src/lib/hoa-annual-statement.ts) und dürfen nicht zusätzlich als Kosten
 * auftauchen.
 */
export async function importAnnualStatementCostItemsFromBankingAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const annualStatementId = getString(formData, "annualStatementId");
	const allocationKeyRaw = getString(formData, "allocationKey") as HoaAllocationKey;

	if (!annualStatementId) {
		return { error: t("hoaStatement.errors.notFound") };
	}
	if (!BANKING_IMPORT_ALLOCATION_KEYS.includes(allocationKeyRaw)) {
		return { error: t("hoaStatement.errors.invalidAllocationKey") };
	}

	const existing = await requireDraftAnnualStatement(annualStatementId);
	if ("error" in existing) return { error: existing.error };

	// Die WEG hängt 1:1 an einer Liegenschaft - deren Bankkonto/Kontenrahmen
	// ist die Datenbasis (geteilte Buchhaltung der Mietverwaltung).
	const detail = getAnnualStatementDetail(annualStatementId);
	if (!detail) {
		return { error: t("hoaStatement.errors.notFound") };
	}

	// Konto-Summen bewusst SERVERSEITIG neu ermitteln (autoritativ,
	// unabhängig von der ggf. veralteten Vorschau im Dialog).
	const accountSums = listAccountBookingSumsForPeriod(detail.hoa.propertyId, existing.statement.periodFrom, existing.statement.periodTo);
	const items = buildCostItemsFromAccountBookingSums(accountSums, allocationKeyRaw);
	if (items.length === 0) {
		return { error: t("hoaStatement.errors.bankingImportNothingFound") };
	}

	try {
		createHoaCostItems(
			items.map((item) => ({
				context: "STATEMENT" as const,
				economicPlanId: null,
				annualStatementId,
				label: item.label,
				amount: item.amount,
				allocationKey: item.allocationKey,
				directUnitId: null,
				customAllocationKeyId: null,
				isApportionable: true,
				notes: item.notes,
			}))
		);
	} catch (error) {
		console.error("importAnnualStatementCostItemsFromBankingAction failed", error);
		return { error: t("hoaStatement.errors.bankingImportFailed") };
	}

	logActivity(
		user,
		"CREATE",
		"jahresabrechnung",
		`Kontobewegungen aus der Buchhaltung als ${items.length} Kostenposition${items.length === 1 ? "" : "en"} in die Jahresabrechnung „${periodLabel(
			new Date(existing.statement.periodFrom),
			new Date(existing.statement.periodTo)
		)}“ übernommen`,
		annualStatementId
	);

	revalidatePath(`/weg/jahresabrechnung/${annualStatementId}`);
	return {
		success: true,
		message: t(items.length === 1 ? "hoaStatement.success.bankingImport.one" : "hoaStatement.success.bankingImport.other", { count: items.length }),
	};
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
// PDF-Erzeugung: versandfertige Einzelabrechnung je Eigentümer
// ============================================================
//
// Nutzt ausschließlich die beim Finalisieren bereits berechneten und
// dauerhaft eingefrorenen AnnualStatementUnitResult(-Line)-Datensätze als
// Datenquelle (keine erneute Berechnung, keine Duplizierung der Logik aus
// src/lib/hoa-annual-statement.ts) - ein PDF kann daher nur für
// finalisierte Abrechnungen erzeugt werden, nicht für Entwürfe.

async function buildAndSaveUnitResultPdf(data: NonNullable<Awaited<ReturnType<typeof getAnnualStatementUnitResultForPdf>>>): Promise<ActionState> {
	const settings = getCompanySettings();
	const senderLines = companySettingsToAddressLines(settings);

	const owner = data.owner;
	const ownerNameLine = owner.isCompany ? owner.companyName ?? `${owner.firstName} ${owner.lastName}` : `${owner.firstName} ${owner.lastName}`;

	const pdfBuffer = await generateHoaAnnualStatementPdf({
		senderLines,
		senderAdditional: settings.additional,
		recipientLines: [ownerNameLine, owner.street, `${owner.zipCode} ${owner.city}`],
		dateLine: formatDate(new Date()),
		hoaName: data.hoa.name,
		unitLabel: data.unit.label,
		periodFrom: new Date(data.statement.periodFrom),
		periodTo: new Date(data.statement.periodTo),
		ownedFrom: new Date(data.unitResult.ownedFrom),
		ownedTo: new Date(data.unitResult.ownedTo),
		ownedDays: data.unitResult.ownedDays,
		lines: data.lines.map((line) => ({
			label: line.costItem.label,
			totalAmount: line.costItem.amount,
			allocationKeyLabel: hoaAllocationKeyLabels[line.costItem.allocationKey],
			ownerShare: line.amount,
		})),
		totalAllocatedCosts: data.unitResult.totalAllocatedCosts,
		totalPrepayments: data.unitResult.totalPrepayments,
		balance: data.unitResult.balance,
	});

	const fileName = `Hausgeldabrechnung ${data.hoa.name} ${data.unit.label} ${owner.lastName}.pdf`;
	const saved = await saveGeneratedFile(pdfBuffer, "hoa-annual-statements", fileName);

	const previousPdfPath = data.unitResult.pdfPath;

	updateAnnualStatementUnitResultPdf(data.unitResult.id, {
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
 * Erzeugt (bzw. erneuert) das versandfertige PDF für eine einzelne
 * Eigentümer-Einzelabrechnung. Erlaubt erneutes Erzeugen (z. B. nach
 * Korrektur der Absenderdaten unter /einstellungen) - ersetzt ein zuvor
 * erzeugtes PDF.
 */
export async function generateHoaAnnualStatementPdfAction(unitResultId: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const data = getAnnualStatementUnitResultForPdf(unitResultId);
	if (!data) {
		return { error: t("hoaStatement.errors.statementNotFound") };
	}

	try {
		const result = await buildAndSaveUnitResultPdf(data);
		if ("error" in result) return result;
		logActivity(
			user,
			"CREATE",
			"jahresabrechnung",
			`Abrechnungs-PDF für „${data.owner.firstName} ${data.owner.lastName}“ (${data.unit.label}) erzeugt`,
			unitResultId
		);
	} catch (error) {
		console.error("generateHoaAnnualStatementPdfAction failed", error);
		return { error: t("hoaStatement.errors.pdfFailed") };
	}

	revalidatePath(`/weg/jahresabrechnung/${data.statement.id}`);
	revalidatePath(`/dokumente`);
	return { success: true };
}

/**
 * Erzeugt in einem Zug die PDFs für alle Einzelabrechnungen einer
 * Jahresabrechnung (z. B. für den anschließenden Massenversand). Bereits
 * erzeugte PDFs werden dabei erneuert (siehe
 * generateHoaAnnualStatementPdfAction).
 */
export async function generateAllHoaAnnualStatementPdfsAction(annualStatementId: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const statement = getAnnualStatement(annualStatementId);
	if (!statement) {
		return { error: t("hoaStatement.errors.notFound") };
	}
	if (statement.status !== "FINALIZED") {
		return { error: t("hoaStatement.errors.pdfRequiresFinalized") };
	}

	const unitResultIds = listAnnualStatementUnitResultIds(annualStatementId);

	let failedCount = 0;
	for (const id of unitResultIds) {
		const data = getAnnualStatementUnitResultForPdf(id);
		if (!data) {
			failedCount += 1;
			continue;
		}
		try {
			await buildAndSaveUnitResultPdf(data);
		} catch (error) {
			console.error(`generateAllHoaAnnualStatementPdfsAction: PDF für Einzelabrechnung ${id} fehlgeschlagen`, error);
			failedCount += 1;
		}
	}

	const generatedCount = unitResultIds.length - failedCount;
	if (generatedCount > 0) {
		logActivity(
			user,
			"CREATE",
			"jahresabrechnung",
			`Abrechnungs-PDFs für die Jahresabrechnung „${periodLabel(new Date(statement.periodFrom), new Date(statement.periodTo))}“ erzeugt (${generatedCount} Stück)`,
			annualStatementId
		);
	}

	revalidatePath(`/weg/jahresabrechnung/${annualStatementId}`);
	revalidatePath(`/dokumente`);

	if (failedCount > 0) {
		return {
			error: t("hoaStatement.errors.somePdfsFailed", { failed: failedCount, total: unitResultIds.length }),
		};
	}

	return { success: true };
}

// ============================================================
// Postversand: versandfertiges Abrechnungs-PDF per LetterXpress verschicken
// ============================================================

/**
 * Verschickt das bereits erzeugte PDF einer Eigentümer-Einzelabrechnung
 * per Post (LetterXpress API, siehe src/lib/letterxpress.ts). Setzt
 * voraus, dass zuvor bereits ein PDF erzeugt wurde
 * (generateHoaAnnualStatementPdfAction) - ohne pdfPath gibt es nichts zu
 * versenden.
 */
export async function sendHoaAnnualStatementByPostAction(unitResultId: string): Promise<PostalShipmentActionState> {
	const user = await requireUser();
	const t = await getT();
	const data = getAnnualStatementUnitResultForPdf(unitResultId);
	if (!data) {
		return { error: t("hoaStatement.errors.statementNotFound") };
	}
	if (!data.unitResult.pdfPath) {
		return { error: t("hoaStatement.errors.pdfRequiredBeforePost") };
	}

	const result = await sendPdfByPostForSource("HOA_ANNUAL_STATEMENT", unitResultId, user.id, await getT());

	if ("success" in result) {
		logActivity(user, "CREATE", "postversand", `WEG-Abrechnung für „${data.owner.firstName} ${data.owner.lastName}“ (${data.unit.label}) per Post versendet`, unitResultId);
	}

	revalidatePath(`/weg/jahresabrechnung/${data.statement.id}`);
	return result;
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
				label: item.label,
				amount: item.amount,
				allocationKey: item.allocationKey,
				directUnitId: bridgeData.unitResult.unitId,
				customAllocationKeyId: null,
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