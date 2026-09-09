import {
	createBillingPeriod,
	createCostItem,
	deleteBillingPeriod,
	deleteCostItem,
	finalizeBillingPeriod,
	getBillingPeriod,
	getBillingPeriodDetail,
	getCostItem,
	listBillingPeriods,
	saveConsumptionValuesForCostItem,
	updateBillingPeriod,
	updateCostItem,
	type BillingPeriodInput,
	type CostItemInput,
} from "@/data/billing";
import { getCompanySettings, saveCompanySettings, type CompanySettingsInput } from "@/data/company-settings";
import { upsertDepositForLease, getDepositByLeaseId, type DepositInput } from "@/data/deposits";
import { createDocument, deleteDocument, getDocument, listUploadedDocumentOverviewRows } from "@/data/documents";
import {
	createLease,
	createRentAdjustment,
	deleteLease,
	deleteRentAdjustment,
	getLeaseWithDetails,
	listLeasesWithDetails,
	listLeasesWithRentAdjustments,
	updateLease,
	updateRentAdjustment,
	type LeaseInput,
	type RentAdjustmentInput,
} from "@/data/leases";
import { createProperty, deleteProperty, getProperty, listProperties, updateProperty, type PropertyInput } from "@/data/properties";
import {
	createDocumentTemplate,
	deleteDocumentTemplate,
	deleteGeneratedDocument,
	getDocumentTemplate,
	getGeneratedDocument,
	listDocumentTemplates,
	listGeneratedDocumentsFiltered,
	updateDocumentTemplate,
	type DocumentTemplateInput,
} from "@/data/templates";
import { createTenant, deleteTenant, getTenant, listTenants, updateTenant, type TenantInput } from "@/data/tenants";
import { createTicket, deleteTicket, listTickets, updateTicket, updateTicketStatus, type TicketInput } from "@/data/tickets";
import {
	createTransaction,
	deleteTransaction,
	generateDueTransactions,
	getTransaction,
	listTransactions,
	markTransactionPaid,
	updateTransaction,
	type DueTransactionCandidate,
	type TransactionInput,
} from "@/data/transactions";
import { createUnit, deleteUnit, getUnit, listUnits, updateUnit, type UnitInput } from "@/data/units";
import { calculateBillingResult } from "@/lib/billing";
import { centsToDecimalString } from "@/lib/money";
import { getTotalRentForDate } from "@/lib/rent-history";
import { deleteUploadedFile, getUploadedFile, saveUploadedFile } from "@/lib/storage";

import { McpToolError, buildInputSchema, coerceArgs, registerCrudTools, registerTool, type FieldSpec } from "./registry";

/**
 * MCP-Werkzeuge der Mietverwaltung (Stammdaten, Verträge, Finanzen,
 * Nebenkostenabrechnung, Dokumente/DMS, Vorlagen). Die Werkzeuge rufen
 * ausschließlich den Repository-Layer (src/data/) und die fachlichen
 * Berechnungs-Bibliotheken (src/lib/) auf und spiegeln die in den
 * Server Actions der App umgesetzten Fachregeln (z. B. "nur Entwürfe
 * sind änder-/löschbar").
 */

const TICKET_STATUS = ["OPEN", "IN_PROGRESS", "DONE"] as const;
const TRANSACTION_STATUS = ["OPEN", "PAID", "OVERDUE", "CANCELLED"] as const;
const DEPOSIT_TYPES = ["CASH", "BANK_GUARANTEE", "BLOCKED_ACCOUNT"] as const;
const DEPOSIT_STATUS = ["PENDING", "RECEIVED", "PARTIALLY_REFUNDED", "REFUNDED"] as const;
const DOCUMENT_TYPES = ["CONTRACT", "INVOICE", "FLOORPLAN", "OTHER"] as const;
const TEMPLATE_CATEGORIES = ["WARNING", "BILLING", "GENERAL", "TERMINATION", "OTHER"] as const;
const ALLOCATION_KEYS = ["LIVING_SPACE", "OCCUPANTS", "UNITS", "CONSUMPTION", "DIRECT"] as const;
const COST_CATEGORIES = [
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
] as const;

const MONTH_NAMES = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** Maximale Dateigröße für Upload/Download über MCP (Base64 im JSON). */
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

function requireBillingPeriodDraft(billingPeriodId: string, action: string): void {
	const period = getBillingPeriod(billingPeriodId);
	if (!period) throw new McpToolError(`Abrechnungsperiode mit ID "${billingPeriodId}" wurde nicht gefunden.`);
	if (period.status !== "DRAFT") {
		throw new McpToolError(`Die Abrechnungsperiode ist bereits finalisiert und kann nicht mehr ${action} werden.`);
	}
}

// ============================================================
// Stammdaten: Liegenschaften, Einheiten, Mieter
// ============================================================

registerCrudTools<PropertyInput>({
	entity: "properties",
	entityLabel: "Liegenschaft",
	fields: {
		name: { type: "string" },
		street: { type: "string" },
		zipCode: { type: "string", description: "Postleitzahl" },
		city: { type: "string" },
		country: { type: "string" },
		notes: { type: "string", nullable: true },
	},
	list: () => listProperties(),
	get: (id) => getProperty(id),
	create: (input) => createProperty(input),
	update: (id, input) => updateProperty(id, input),
	delete: (id) => deleteProperty(id),
});

registerCrudTools<UnitInput>({
	entity: "units",
	entityLabel: "Mieteinheit",
	fields: {
		propertyId: { type: "string", description: "ID der Liegenschaft (properties_list)" },
		label: { type: "string", description: "Bezeichnung, z. B. \"Whg. 1 links\"" },
		floor: { type: "string", nullable: true },
		livingSpace: { type: "float", nullable: true, description: "Wohnfläche in m²" },
		rooms: { type: "float", nullable: true },
		coOwnershipShare: { type: "int", nullable: true, description: "Miteigentumsanteil (Zähler; nur für WEG-Liegenschaften)" },
	},
	listFilters: { propertyId: { type: "string", nullable: true } },
	list: (filter) => listUnits(filter.propertyId ? { propertyId: filter.propertyId as string } : undefined),
	get: (id) => getUnit(id),
	create: (input) => {
		if (!getProperty(input.propertyId)) throw new McpToolError("Die angegebene Liegenschaft existiert nicht.");
		return createUnit(input);
	},
	update: (id, input) => {
		if (!getProperty(input.propertyId)) throw new McpToolError("Die angegebene Liegenschaft existiert nicht.");
		updateUnit(id, input);
	},
	delete: (id) => deleteUnit(id),
});

registerCrudTools<TenantInput>({
	entity: "tenants",
	entityLabel: "Mieter",
	fields: {
		firstName: { type: "string" },
		lastName: { type: "string" },
		email: { type: "string", nullable: true },
		phone: { type: "string", nullable: true },
		notes: { type: "string", nullable: true },
	},
	list: () => listTenants(),
	get: (id) => getTenant(id),
	create: (input) => createTenant(input),
	update: (id, input) => updateTenant(id, input),
	delete: (id) => deleteTenant(id),
});

// ============================================================
// Mietverträge, Mietanpassungen, Kautionen
// ============================================================

const leaseFields: Record<string, FieldSpec> = {
	unitId: { type: "string", description: "ID der Einheit (units_list)" },
	tenantId: { type: "string", description: "ID des Mieters (tenants_list)" },
	startDate: { type: "date", description: "Mietbeginn" },
	endDate: { type: "date", nullable: true, description: "Mietende (null = unbefristet)" },
	coldRent: { type: "decimal", description: "Kaltmiete" },
	serviceCharges: { type: "decimal", description: "Nebenkosten-Vorauszahlung" },
	numberOfOccupants: { type: "int" },
	deposit: { type: "decimal", nullable: true, description: "Vereinbarte Kaution" },
	notes: { type: "string", nullable: true },
};

registerCrudTools<LeaseInput>({
	entity: "leases",
	entityLabel: "Mietvertrag",
	fields: leaseFields,
	listFilters: {
		unitId: { type: "string", nullable: true },
		tenantId: { type: "string", nullable: true },
	},
	list: (filter) =>
		listLeasesWithDetails({
			unitId: (filter.unitId as string) ?? undefined,
			tenantId: (filter.tenantId as string) ?? undefined,
		}),
	get: (id) => getLeaseWithDetails(id),
	beforeCreate: (input) => {
		if (!getUnit(input.unitId)) return "Die angegebene Einheit existiert nicht.";
		if (!getTenant(input.tenantId)) return "Der angegebene Mieter existiert nicht.";
		return null;
	},
	beforeUpdate: (_id, input) => {
		if (!getUnit(input.unitId)) return "Die angegebene Einheit existiert nicht.";
		if (!getTenant(input.tenantId)) return "Der angegebene Mieter existiert nicht.";
		return null;
	},
	create: (input) => createLease(input),
	update: (id, input) => updateLease(id, input),
	delete: (id) => deleteLease(id),
});

const rentAdjustmentFields: Record<string, FieldSpec> = {
	leaseId: { type: "string", description: "ID des Mietvertrags" },
	validFrom: { type: "date", description: "Gültig ab" },
	coldRent: { type: "decimal" },
	serviceCharges: { type: "decimal" },
	notes: { type: "string", nullable: true },
};

registerCrudTools<RentAdjustmentInput>({
	entity: "rent_adjustments",
	entityLabel: "Miet-/Nebenkosten-Änderung",
	fields: rentAdjustmentFields,
	listFilters: { leaseId: { type: "string", description: "ID des Mietvertrags (Pflicht)" } },
	list: (filter) => {
		const lease = getLeaseWithDetails(filter.leaseId as string);
		if (!lease) throw new McpToolError(`Mietvertrag mit ID "${filter.leaseId as string}" wurde nicht gefunden.`);
		return lease.rentAdjustments;
	},
	beforeCreate: (input) => (getLeaseWithDetails(input.leaseId) ? null : "Der angegebene Mietvertrag existiert nicht."),
	beforeUpdate: (_id, input) => (getLeaseWithDetails(input.leaseId) ? null : "Der angegebene Mietvertrag existiert nicht."),
	create: (input) => createRentAdjustment(input),
	update: (id, input) => updateRentAdjustment(id, input),
	delete: (id) => deleteRentAdjustment(id),
});

const depositFields: Record<string, FieldSpec> = {
	leaseId: { type: "string", description: "ID des Mietvertrags (pro Vertrag gibt es genau ein Kautionskonto)" },
	type: { type: "enum", values: DEPOSIT_TYPES },
	amount: { type: "decimal" },
	status: { type: "enum", values: DEPOSIT_STATUS },
	receivedDate: { type: "date", nullable: true },
	refundedDate: { type: "date", nullable: true },
	refundedAmount: { type: "decimal", nullable: true },
	notes: { type: "string", nullable: true },
};

registerTool({
	name: "deposits_get",
	description: "Liefert das Kautionskonto eines Mietvertrags (null, wenn noch keines angelegt wurde).",
	inputSchema: buildInputSchema({ leaseId: { type: "string" } }),
	handler: (args) => {
		const { leaseId } = coerceArgs({ leaseId: { type: "string" } }, args);
		if (!getLeaseWithDetails(leaseId as string)) throw new McpToolError("Der angegebene Mietvertrag existiert nicht.");
		return getDepositByLeaseId(leaseId as string);
	},
});

registerTool({
	name: "deposits_upsert",
	description: "Legt das Kautionskonto eines Mietvertrags an bzw. aktualisiert es (pro Vertrag genau eines).",
	inputSchema: buildInputSchema(depositFields),
	handler: (args) => {
		const input = coerceArgs(depositFields, args) as unknown as DepositInput;
		if (!getLeaseWithDetails(input.leaseId)) throw new McpToolError("Der angegebene Mietvertrag existiert nicht.");
		return upsertDepositForLease(input);
	},
});

// ============================================================
// Tickets (Instandhaltung)
// ============================================================

function findTicket(id: string) {
	return listTickets().find((ticket) => ticket.id === id) ?? null;
}

registerCrudTools<TicketInput>({
	entity: "tickets",
	entityLabel: "Ticket",
	fields: {
		propertyId: { type: "string", description: "ID der Liegenschaft" },
		unitId: { type: "string", nullable: true, description: "ID der Einheit (optional)" },
		title: { type: "string" },
		description: { type: "string", nullable: true },
		status: { type: "enum", values: TICKET_STATUS },
		contractorNotes: { type: "string", nullable: true, description: "Notizen zum Handwerker" },
	},
	fieldsHint: "Bei Status \"DONE\" wird resolvedAt automatisch auf jetzt gesetzt, sonst auf null.",
	listFilters: {
		propertyId: { type: "string", nullable: true },
		unitId: { type: "string", nullable: true },
	},
	list: (filter) =>
		listTickets({
			propertyId: (filter.propertyId as string) ?? undefined,
			unitId: (filter.unitId as string) ?? undefined,
		}),
	get: (id) => findTicket(id),
	beforeCreate: (input) => {
		if (!getProperty(input.propertyId)) return "Die angegebene Liegenschaft existiert nicht.";
		if (input.unitId && !getUnit(input.unitId)) return "Die angegebene Einheit existiert nicht.";
		return null;
	},
	beforeUpdate: (_id, input) => {
		if (!getProperty(input.propertyId)) return "Die angegebene Liegenschaft existiert nicht.";
		if (input.unitId && !getUnit(input.unitId)) return "Die angegebene Einheit existiert nicht.";
		return null;
	},
	create: (input) =>
		createTicket({
			...input,
			resolvedAt: input.status === "DONE" ? new Date().toISOString() : null,
		}),
	update: (id, input) => {
		const existing = findTicket(id);
		const resolvedAt = input.status === "DONE" ? (existing?.resolvedAt ?? new Date().toISOString()) : null;
		updateTicket(id, { ...input, resolvedAt });
	},
	delete: (id) => deleteTicket(id),
});

registerTool({
	name: "tickets_set_status",
	description: "Setzt nur den Status eines Tickets (Schnellaktion der Kanban-Ansicht). Bei \"DONE\" wird resolvedAt auf jetzt gesetzt, sonst zurückgesetzt.",
	inputSchema: buildInputSchema({
		id: { type: "string" },
		status: { type: "enum", values: TICKET_STATUS },
	}),
	handler: (args) => {
		const input = coerceArgs({ id: { type: "string" }, status: { type: "enum", values: TICKET_STATUS } }, args);
		const id = input.id as string;
		if (!findTicket(id)) throw new McpToolError(`Ticket mit ID "${id}" wurde nicht gefunden.`);
		const status = input.status as "OPEN" | "IN_PROGRESS" | "DONE";
		updateTicketStatus(id, status, status === "DONE" ? new Date().toISOString() : null);
		return { success: true, id, status };
	},
});

// ============================================================
// Finanzen (Mieteingänge)
// ============================================================

const transactionFields: Record<string, FieldSpec> = {
	leaseId: { type: "string", description: "ID des Mietvertrags" },
	amount: { type: "decimal" },
	dueDate: { type: "date", description: "Fälligkeitsdatum" },
	paidDate: { type: "date", nullable: true, description: "Zahlungsdatum (null = unbezahlt)" },
	purpose: { type: "string", nullable: true, description: "Verwendungszweck, z. B. \"Miete Januar 2026\"" },
	status: { type: "enum", values: TRANSACTION_STATUS },
};

registerCrudTools<TransactionInput>({
	entity: "transactions",
	entityLabel: "Zahlung (Mieteingang)",
	fields: transactionFields,
	listFilters: { leaseId: { type: "string", nullable: true } },
	list: (filter) => listTransactions(filter.leaseId ? { leaseId: filter.leaseId as string } : {}),
	get: (id) => getTransaction(id),
	beforeCreate: (input) => (getLeaseWithDetails(input.leaseId) ? null : "Der angegebene Mietvertrag existiert nicht."),
	beforeUpdate: (_id, input) => (getLeaseWithDetails(input.leaseId) ? null : "Der angegebene Mietvertrag existiert nicht."),
	create: (input) => createTransaction(input),
	update: (id, input) => updateTransaction(id, input),
	delete: (id) => deleteTransaction(id),
});

registerTool({
	name: "transactions_mark_paid",
	description: "Markiert eine Zahlung als bezahlt (Status PAID, Zahldatum = jetzt).",
	inputSchema: buildInputSchema({ id: { type: "string" } }),
	handler: (args) => {
		const { id } = coerceArgs({ id: { type: "string" } }, args);
		if (!getTransaction(id as string)) throw new McpToolError(`Zahlung mit ID "${id as string}" wurde nicht gefunden.`);
		markTransactionPaid(id as string);
		return { success: true, id };
	},
});

registerTool({
	name: "transactions_generate_due",
	description:
		"Stellt für einen Zeitraum automatisch die Monatsmieten (Kaltmiete + Nebenkosten) aller aktiven Mietverträge fällig. " +
		"Pro Vertrag und Monat wird eine offene Zahlung angelegt, sofern noch keine existiert (Duplikate werden übersprungen).",
	inputSchema: buildInputSchema({
		fromMonth: { type: "string", description: "Startmonat im Format \"YYYY-MM\"" },
		toMonth: { type: "string", description: "Endmonat im Format \"YYYY-MM\"" },
		dueDay: { type: "int", description: "Fälligkeitstag im Monat (1-28)" },
	}),
	handler: (args) => {
		const input = coerceArgs(
			{
				fromMonth: { type: "string" },
				toMonth: { type: "string" },
				dueDay: { type: "int" },
			},
			args
		);
		const fromMatch = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(input.fromMonth as string);
		const toMatch = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(input.toMonth as string);
		if (!fromMatch || !toMatch) throw new McpToolError("Bitte einen gültigen Zeitraum im Format \"YYYY-MM\" angeben.");

		const dueDay = input.dueDay as number;
		if (dueDay < 1 || dueDay > 28) throw new McpToolError("Der Fälligkeitstag muss zwischen 1 und 28 liegen.");

		const startIndex = Number(fromMatch[1]) * 12 + (Number(fromMatch[2]) - 1);
		const endIndex = Number(toMatch[1]) * 12 + (Number(toMatch[2]) - 1);
		if (endIndex < startIndex) throw new McpToolError("Das Enddatum darf nicht vor dem Startdatum liegen.");
		if (endIndex - startIndex > 60) throw new McpToolError("Der Zeitraum darf maximal 61 Monate umfassen.");

		const months: { year: number; month: number }[] = [];
		for (let index = startIndex; index <= endIndex; index += 1) {
			months.push({ year: Math.floor(index / 12), month: index % 12 });
		}

		// Fachliche Ermittlung der Kandidaten (Vertrag läuft im Fälligkeitsmonat,
		// gültiger Betrag aus dem Mietverlauf) - identisch zur Server Action
		// generateDueTransactionsAction in src/app/(app)/finanzen/actions.ts.
		const candidates: DueTransactionCandidate[] = [];
		for (const lease of listLeasesWithRentAdjustments()) {
			for (const { year, month } of months) {
				const dueDate = new Date(year, month, dueDay);
				if (new Date(lease.startDate) > dueDate) continue;
				if (lease.endDate && new Date(lease.endDate) < dueDate) continue;

				const monthStart = new Date(year, month, 1);
				const monthEnd = new Date(year, month + 1, 1);
				candidates.push({
					leaseId: lease.id,
					amount: getTotalRentForDate(lease, lease.rentAdjustments, dueDate).toFixed(2),
					dueDate: dueDate.toISOString(),
					purpose: `Miete ${MONTH_NAMES[month]} ${year}`,
					monthStart: monthStart.toISOString(),
					monthEnd: monthEnd.toISOString(),
				});
			}
		}

		return generateDueTransactions(candidates);
	},
});

// ============================================================
// Dokumente (DMS) - inkl. Datei-Upload/-Download (Base64)
// ============================================================

registerTool({
	name: "documents_list",
	description: "Listet hochgeladene Dokumente des DMS (inkl. verknüpfter Liegenschaft/Einheit/Mieter).",
	inputSchema: buildInputSchema({
		propertyId: { type: "string", nullable: true },
		unitId: { type: "string", nullable: true },
		tenantId: { type: "string", nullable: true },
	}),
	handler: (args) => {
		const filter = coerceArgs(
			{
				propertyId: { type: "string", nullable: true },
				unitId: { type: "string", nullable: true },
				tenantId: { type: "string", nullable: true },
			},
			args
		);
		return listUploadedDocumentOverviewRows({
			propertyId: (filter.propertyId as string) ?? undefined,
			unitId: (filter.unitId as string) ?? undefined,
			tenantId: (filter.tenantId as string) ?? undefined,
		});
	},
});

registerTool({
	name: "documents_get",
	description: "Liefert die Metadaten eines Dokuments per ID.",
	inputSchema: buildInputSchema({ id: { type: "string" } }),
	handler: (args) => {
		const { id } = coerceArgs({ id: { type: "string" } }, args);
		const document = getDocument(id as string);
		if (!document) throw new McpToolError(`Dokument mit ID "${id as string}" wurde nicht gefunden.`);
		return document;
	},
});

registerTool({
	name: "documents_upload",
	description:
		"Lädt eine Datei (Base64-kodiert) ins DMS hoch und legt den Dokumentendatensatz an. " +
		"Mindestens eine Verknüpfung (Liegenschaft, Einheit oder Mieter) sollte gesetzt werden.",
	inputSchema: {
		type: "object",
		properties: {
			fileName: { type: "string", description: "Dateiname inkl. Endung, z. B. \"mietvertrag.pdf\"" },
			contentBase64: { type: "string", description: "Dateiinhalt, Base64-kodiert" },
			type: { type: "string", enum: [...DOCUMENT_TYPES] },
			propertyId: { type: ["string", "null"] },
			unitId: { type: ["string", "null"] },
			tenantId: { type: ["string", "null"] },
		},
		required: ["fileName", "contentBase64", "type"],
		additionalProperties: false,
	},
	handler: async (args) => {
		const input = coerceArgs(
			{
				fileName: { type: "string" },
				contentBase64: { type: "string" },
				type: { type: "enum", values: DOCUMENT_TYPES },
				propertyId: { type: "string", nullable: true },
				unitId: { type: "string", nullable: true },
				tenantId: { type: "string", nullable: true },
			},
			args
		);
		const buffer = Buffer.from(input.contentBase64 as string, "base64");
		if (buffer.length === 0) throw new McpToolError("Der Dateiinhalt ist leer oder kein gültiges Base64.");
		if (buffer.length > MAX_FILE_SIZE_BYTES) throw new McpToolError("Die Datei überschreitet die maximale Größe von 20 MB.");

		if (input.propertyId && !getProperty(input.propertyId as string)) throw new McpToolError("Die angegebene Liegenschaft existiert nicht.");
		if (input.unitId && !getUnit(input.unitId as string)) throw new McpToolError("Die angegebene Einheit existiert nicht.");
		if (input.tenantId && !getTenant(input.tenantId as string)) throw new McpToolError("Der angegebene Mieter existiert nicht.");

		const file = new File([new Uint8Array(buffer)], input.fileName as string);
		const saved = await saveUploadedFile(file, "documents");
		return createDocument({
			propertyId: (input.propertyId as string) ?? null,
			unitId: (input.unitId as string) ?? null,
			tenantId: (input.tenantId as string) ?? null,
			type: input.type as "CONTRACT" | "INVOICE" | "FLOORPLAN" | "OTHER",
			fileName: saved.fileName,
			filePath: saved.relativePath,
			mimeType: saved.mimeType,
			fileSize: saved.fileSize,
		});
	},
});

registerTool({
	name: "documents_download",
	description: "Lädt den Dateiinhalt eines Dokuments (Base64-kodiert).",
	inputSchema: buildInputSchema({ id: { type: "string" } }),
	handler: async (args) => {
		const { id } = coerceArgs({ id: { type: "string" } }, args);
		const document = getDocument(id as string);
		if (!document) throw new McpToolError(`Dokument mit ID "${id as string}" wurde nicht gefunden.`);
		if (document.fileSize && document.fileSize > MAX_FILE_SIZE_BYTES) {
			throw new McpToolError("Die Datei überschreitet die maximale Größe von 20 MB für den MCP-Download.");
		}
		const file = await getUploadedFile(document.filePath);
		if (!file) throw new McpToolError("Die Datei wurde in der Ablage nicht gefunden.");
		const buffer = Buffer.from(await new Response(file.body).arrayBuffer());
		return { fileName: file.fileName, mimeType: file.mimeType, contentBase64: buffer.toString("base64") };
	},
});

registerTool({
	name: "documents_delete",
	description: "Löscht ein Dokument unwiderruflich (Datensatz und Datei in der Ablage).",
	inputSchema: buildInputSchema({ id: { type: "string" } }),
	handler: async (args) => {
		const { id } = coerceArgs({ id: { type: "string" } }, args);
		const document = getDocument(id as string);
		if (!document) throw new McpToolError(`Dokument mit ID "${id as string}" wurde nicht gefunden.`);
		deleteDocument(id as string);
		await deleteUploadedFile(document.filePath);
		return { success: true, id };
	},
});

// ============================================================
// Nebenkostenabrechnung
// ============================================================

registerCrudTools<BillingPeriodInput>({
	entity: "billing_periods",
	entityLabel: "Abrechnungsperiode",
	fields: {
		propertyId: { type: "string", description: "ID der Liegenschaft" },
		periodFrom: { type: "date", description: "Beginn der Abrechnungsperiode" },
		periodTo: { type: "date", description: "Ende der Abrechnungsperiode" },
		notes: { type: "string", nullable: true },
	},
	listFilters: { propertyId: { type: "string", nullable: true } },
	list: (filter) => listBillingPeriods(filter.propertyId ? { propertyId: filter.propertyId as string } : undefined),
	get: (id) => getBillingPeriodDetail(id),
	beforeCreate: (input) => (getProperty(input.propertyId) ? null : "Die angegebene Liegenschaft existiert nicht."),
	beforeUpdate: (id, input) => {
		const period = getBillingPeriod(id);
		if (!period) return `Abrechnungsperiode mit ID "${id}" wurde nicht gefunden.`;
		if (period.status !== "DRAFT") return "Die Abrechnungsperiode ist bereits finalisiert und kann nicht mehr geändert werden.";
		if (!getProperty(input.propertyId)) return "Die angegebene Liegenschaft existiert nicht.";
		return null;
	},
	beforeDelete: (id) => {
		const period = getBillingPeriod(id);
		if (period && period.status !== "DRAFT") return "Nur Abrechnungsperioden im Entwurfsstatus können gelöscht werden.";
		return null;
	},
	create: (input) => createBillingPeriod(input),
	update: (id, input) => updateBillingPeriod(id, input),
	delete: (id) => deleteBillingPeriod(id),
});

const costItemFields: Record<string, FieldSpec> = {
	billingPeriodId: { type: "string", description: "ID der Abrechnungsperiode" },
	category: { type: "enum", values: COST_CATEGORIES, description: "BetrKV-Kostenkategorie" },
	label: { type: "string" },
	amount: { type: "decimal", description: "Gesamtbetrag der Position" },
	allocationKey: { type: "enum", values: ALLOCATION_KEYS, description: "Verteilerschlüssel (bei DIRECT: directUnitId setzen)" },
	directUnitId: { type: "string", nullable: true, description: "Ziel-Einheit bei allocationKey = DIRECT" },
	notes: { type: "string", nullable: true },
};

registerCrudTools<CostItemInput>({
	entity: "billing_cost_items",
	entityLabel: "Kostenposition (Nebenkostenabrechnung)",
	fields: costItemFields,
	listFilters: { billingPeriodId: { type: "string", description: "ID der Abrechnungsperiode (Pflicht)" } },
	list: (filter) => {
		const detail = getBillingPeriodDetail(filter.billingPeriodId as string);
		if (!detail) throw new McpToolError(`Abrechnungsperiode mit ID "${filter.billingPeriodId as string}" wurde nicht gefunden.`);
		return detail.costItems;
	},
	get: (id) => getCostItem(id),
	beforeCreate: (input) => {
		try {
			requireBillingPeriodDraft(input.billingPeriodId, "geändert");
		} catch (error) {
			return (error as Error).message;
		}
		return null;
	},
	beforeUpdate: (id) => {
		const costItem = getCostItem(id);
		if (!costItem) return `Kostenposition mit ID "${id}" wurde nicht gefunden.`;
		try {
			requireBillingPeriodDraft(costItem.billingPeriodId, "geändert");
		} catch (error) {
			return (error as Error).message;
		}
		return null;
	},
	beforeDelete: (id) => {
		const costItem = getCostItem(id);
		if (!costItem) return null;
		try {
			requireBillingPeriodDraft(costItem.billingPeriodId, "geändert");
		} catch (error) {
			return (error as Error).message;
		}
		return null;
	},
	create: (input) => createCostItem(input),
	update: (id, input) => updateCostItem(id, input),
	delete: (id) => deleteCostItem(id),
});

registerTool({
	name: "billing_consumption_values_save",
	description:
		"Speichert die Verbrauchswerte (Upsert je Einheit) einer Kostenposition mit allocationKey = CONSUMPTION. " +
		"Nur möglich, solange die Abrechnungsperiode im Entwurfsstatus ist.",
	inputSchema: {
		type: "object",
		properties: {
			costItemId: { type: "string" },
			values: {
				type: "array",
				items: {
					type: "object",
					properties: { unitId: { type: "string" }, value: { type: ["string", "number"] } },
					required: ["unitId", "value"],
				},
				description: "Verbrauchswerte je Einheit",
			},
		},
		required: ["costItemId", "values"],
		additionalProperties: false,
	},
	handler: (args) => {
		if (typeof args !== "object" || args === null || Array.isArray(args)) throw new McpToolError("Die Argumente müssen ein JSON-Objekt sein.");
		const { costItemId, values } = args as Record<string, unknown>;
		if (typeof costItemId !== "string" || !costItemId) throw new McpToolError('Pflichtfeld "costItemId" fehlt.');
		if (!Array.isArray(values)) throw new McpToolError('Pflichtfeld "values" muss ein Array aus { unitId, value } sein.');

		const costItem = getCostItem(costItemId);
		if (!costItem) throw new McpToolError(`Kostenposition mit ID "${costItemId}" wurde nicht gefunden.`);
		requireBillingPeriodDraft(costItem.billingPeriodId, "geändert");

		const parsed = values.map((entry, index) => {
			const { unitId, value } = coerceArgs(
				{ unitId: { type: "string" }, value: { type: "decimal" } },
				{ unitId: (entry as Record<string, unknown>)?.unitId, value: (entry as Record<string, unknown>)?.value }
			);
			if (!getUnit(unitId as string)) throw new McpToolError(`Einheit "${unitId as string}" (Eintrag ${index + 1}) existiert nicht.`);
			return { unitId: unitId as string, value: value as string };
		});

		saveConsumptionValuesForCostItem(costItemId, parsed);
		return { success: true, costItemId, saved: parsed.length };
	},
});

registerTool({
	name: "billing_periods_finalize",
	description:
		"Berechnet die vollständige Kostenumlage einer Abrechnungsperiode und friert das Ergebnis dauerhaft als " +
		"Einzelabrechnungen (tenant_statements) ein. Danach ist die Periode unveränderlich. Läuft atomar in einer Transaktion.",
	inputSchema: buildInputSchema({ id: { type: "string", description: "ID der Abrechnungsperiode" } }),
	handler: (args) => {
		const { id } = coerceArgs({ id: { type: "string" } }, args);
		const detail = getBillingPeriodDetail(id as string);
		if (!detail) throw new McpToolError(`Abrechnungsperiode mit ID "${id as string}" wurde nicht gefunden.`);
		if (detail.billingPeriod.status !== "DRAFT") throw new McpToolError("Diese Abrechnungsperiode wurde bereits finalisiert.");
		if (detail.costItems.length === 0) throw new McpToolError("Bitte erfassen Sie mindestens eine Kostenposition, bevor Sie finalisieren.");

		// Berechnung identisch zur Server Action finalizeBillingPeriodAction
		// (src/app/(app)/abrechnung/actions.ts) über die reine Funktion
		// calculateBillingResult (src/lib/billing.ts).
		const result = calculateBillingResult({
			periodFrom: new Date(detail.billingPeriod.periodFrom),
			periodTo: new Date(detail.billingPeriod.periodTo),
			units: detail.units.map((unit) => ({ id: unit.id, livingSpace: unit.livingSpace, leases: unit.leases })),
			costItems: detail.costItems.map((costItem) => ({
				id: costItem.id,
				amount: costItem.amount,
				allocationKey: costItem.allocationKey,
				directUnitId: costItem.directUnitId,
				consumptionValues: costItem.consumptionValues,
			})),
		});

		if (result.leaseResults.length === 0) {
			throw new McpToolError("Für den gewählten Zeitraum wurden keine Mietverhältnisse gefunden, die abgerechnet werden könnten.");
		}

		finalizeBillingPeriod(
			id as string,
			result.leaseResults.map((leaseResult) => ({
				leaseId: leaseResult.leaseId,
				occupiedFrom: leaseResult.occupiedFrom.toISOString(),
				occupiedTo: leaseResult.occupiedTo.toISOString(),
				occupiedDays: leaseResult.occupiedDays,
				totalAllocatedCosts: centsToDecimalString(leaseResult.totalAllocatedCostsCents),
				totalPrepayments: centsToDecimalString(leaseResult.totalPrepaymentsCents),
				balance: centsToDecimalString(leaseResult.balanceCents),
				lines: leaseResult.lines.map((line) => ({ costItemId: line.costItemId, amount: centsToDecimalString(line.amountCents) })),
			}))
		);
		return { success: true, id, tenantStatements: result.leaseResults.length };
	},
});

// ============================================================
// Dokumentvorlagen und erzeugte Schreiben
// ============================================================

registerCrudTools<DocumentTemplateInput>({
	entity: "document_templates",
	entityLabel: "Dokumentvorlage",
	fields: {
		title: { type: "string" },
		category: { type: "enum", values: TEMPLATE_CATEGORIES },
		subject: { type: "string", nullable: true },
		body: { type: "string", description: "Vorlagentext mit Platzhaltern (siehe Platzhalter-System der App)" },
	},
	list: () => listDocumentTemplates(),
	get: (id) => getDocumentTemplate(id),
	create: (input) => createDocumentTemplate(input),
	update: (id, input) => updateDocumentTemplate(id, input),
	delete: (id) => deleteDocumentTemplate(id),
});

registerTool({
	name: "generated_documents_list",
	description: "Listet erzeugte Schreiben (aus Dokumentvorlagen), optional gefiltert nach Mieter und/oder Vertrag.",
	inputSchema: buildInputSchema({
		tenantId: { type: "string", nullable: true },
		leaseId: { type: "string", nullable: true },
	}),
	handler: (args) => {
		const filter = coerceArgs({ tenantId: { type: "string", nullable: true }, leaseId: { type: "string", nullable: true } }, args);
		return listGeneratedDocumentsFiltered({
			tenantId: (filter.tenantId as string) ?? undefined,
			leaseId: (filter.leaseId as string) ?? undefined,
		});
	},
});

registerTool({
	name: "generated_documents_get",
	description: "Liefert ein erzeugtes Schreiben per ID (inkl. gerendertem Text).",
	inputSchema: buildInputSchema({ id: { type: "string" } }),
	handler: (args) => {
		const { id } = coerceArgs({ id: { type: "string" } }, args);
		const document = getGeneratedDocument(id as string);
		if (!document) throw new McpToolError(`Schreiben mit ID "${id as string}" wurde nicht gefunden.`);
		return document;
	},
});

registerTool({
	name: "generated_documents_download",
	description: "Lädt die PDF-Datei eines erzeugten Schreibens (Base64-kodiert).",
	inputSchema: buildInputSchema({ id: { type: "string" } }),
	handler: async (args) => {
		const { id } = coerceArgs({ id: { type: "string" } }, args);
		const document = getGeneratedDocument(id as string);
		if (!document) throw new McpToolError(`Schreiben mit ID "${id as string}" wurde nicht gefunden.`);
		if (document.fileSize && document.fileSize > MAX_FILE_SIZE_BYTES) {
			throw new McpToolError("Die Datei überschreitet die maximale Größe von 20 MB für den MCP-Download.");
		}
		const file = await getUploadedFile(document.filePath);
		if (!file) throw new McpToolError("Die Datei wurde in der Ablage nicht gefunden.");
		const buffer = Buffer.from(await new Response(file.body).arrayBuffer());
		return { fileName: file.fileName, mimeType: file.mimeType, contentBase64: buffer.toString("base64") };
	},
});

registerTool({
	name: "generated_documents_delete",
	description: "Löscht ein erzeugtes Schreiben (Datensatz; die PDF-Datei bleibt in der Ablage erhalten, falls sie anderweitig referenziert ist).",
	inputSchema: buildInputSchema({ id: { type: "string" } }),
	handler: (args) => {
		const { id } = coerceArgs({ id: { type: "string" } }, args);
		if (!getGeneratedDocument(id as string)) throw new McpToolError(`Schreiben mit ID "${id as string}" wurde nicht gefunden.`);
		deleteGeneratedDocument(id as string);
		return { success: true, id };
	},
});

// ============================================================
// Absenderdaten (Company Settings, Singleton)
// ============================================================
// adminOnly: Die Absenderdaten gehören zu den Einstellungen, die auch in
// der App nur Administratoren offenstehen (src/app/(app)/einstellungen/).

registerTool({
	name: "company_settings_get",
	description: "Liefert die Absenderdaten (Vermieter/Hausverwaltung) für Briefköpfe erzeugter PDFs.",
	inputSchema: buildInputSchema({}),
	adminOnly: true,
	handler: () => getCompanySettings(),
});

registerTool({
	name: "company_settings_update",
	description: "Aktualisiert die Absenderdaten (Vermieter/Hausverwaltung).",
	inputSchema: buildInputSchema({
		name: { type: "string" },
		street: { type: "string" },
		zipCode: { type: "string" },
		city: { type: "string" },
		additional: { type: "string", nullable: true, description: "Zusatzzeile im Briefkopf (z. B. Kontaktdaten)" },
	}),
	adminOnly: true,
	handler: (args) => {
		const input = coerceArgs(
			{
				name: { type: "string" },
				street: { type: "string" },
				zipCode: { type: "string" },
				city: { type: "string" },
				additional: { type: "string", nullable: true },
			},
			args
		) as unknown as CompanySettingsInput;
		return saveCompanySettings(input);
	},
});

// Hinweis: Die Erzeugung von Schreiben aus Vorlagen (Platzhalter-Vorschau,
// PDF-Rendering) erfolgt bewusst weiterhin über den Dialog der App und wird
// nicht als MCP-Werkzeug angeboten.
