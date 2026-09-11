import {
	createBillingPeriod,
	createCostItem,
	deleteBillingPeriodWithArtifacts,
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
import {
	buildCustomAllocationWeightsByKey,
	createCustomAllocationKey,
	deleteCustomAllocationKey,
	getCustomAllocationKey,
	listCustomAllocationKeysWithWeights,
	updateCustomAllocationKey,
	upsertCustomAllocationKeyWeight,
	type CustomAllocationKeyInput,
} from "@/data/custom-allocation-keys";
import {
	countAllocationsForAccount,
	createAccount,
	deleteAccount,
	getAccount,
	listAccountsWithStats,
	updateAccount,
	type AccountInput,
} from "@/data/accounts";
import {
	createBankTransaction,
	deleteBankTransaction,
	getBankTransaction,
	listBankTransactions,
	setBankTransactionAllocations,
	updateBankTransaction,
	type BankTransactionAllocationInput,
	type BankTransactionInput,
} from "@/data/bank-transactions";
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
import { bankAllocationErrorToGermanMessage, validateBankAllocations, validateBankAllocationsAgainst } from "@/lib/bank-allocations";
import { createTicket, deleteTicket, listTickets, updateTicket, updateTicketStatus, type TicketInput } from "@/data/tickets";
import {
	convertMessageToTicket,
	createTicketMessage,
	deleteMailboxMessage,
	getTicketMessage,
	linkMessageToTicket,
	listMailboxMessages,
	listTicketMessages,
} from "@/data/ticket-messages";
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
import { sendTicketEmail } from "@/lib/ticket-mailer";

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
const BANK_TRANSACTION_STATUS = ["OPEN", "PARTIAL", "RECONCILED"] as const;
const DEPOSIT_TYPES = ["CASH", "BANK_GUARANTEE", "BLOCKED_ACCOUNT"] as const;
const DEPOSIT_STATUS = ["PENDING", "RECEIVED", "PARTIALLY_REFUNDED", "REFUNDED"] as const;
const DOCUMENT_TYPES = ["CONTRACT", "INVOICE", "FLOORPLAN", "OTHER"] as const;
const TEMPLATE_CATEGORIES = ["WARNING", "BILLING", "GENERAL", "TERMINATION", "OTHER"] as const;
const ALLOCATION_KEYS = ["LIVING_SPACE", "UNITS", "CONSUMPTION", "DIRECT", "CUSTOM"] as const;

const MONTH_NAMES = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** Maximale Dateigröße für Upload/Download über MCP (Base64 im JSON). */
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

/** Obergrenze der Banktransaktionen je Aufruf des Import-Werkzeugs. */
const MAX_BANK_TRANSACTION_IMPORT = 200;

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
		propertyId: { type: "string", nullable: true, description: "ID der Liegenschaft (optional, null = Ticket ohne Objektbezug)" },
		unitId: { type: "string", nullable: true, description: "ID der Einheit (optional, nur mit Liegenschaft sinnvoll)" },
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
		if (input.propertyId && !getProperty(input.propertyId)) return "Die angegebene Liegenschaft existiert nicht.";
		if (input.unitId && !getUnit(input.unitId)) return "Die angegebene Einheit existiert nicht.";
		return null;
	},
	beforeUpdate: (_id, input) => {
		if (input.propertyId && !getProperty(input.propertyId)) return "Die angegebene Liegenschaft existiert nicht.";
		if (input.unitId && !getUnit(input.unitId)) return "Die angegebene Einheit existiert nicht.";
		return null;
	},
	create: (input) =>
		createTicket({
			...input,
			// Eine Einheit ist nur mit Liegenschaft sinnvoll.
			unitId: input.propertyId ? input.unitId : null,
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
// Ticket-Kommunikation & Postfach (Mini-Zendesk)
// ============================================================

registerTool({
	name: "ticket_messages_list",
	description:
		"Listet den Kommunikationsverlauf eines Tickets (eingehende/ausgehende E-Mails und interne Notizen, chronologisch). Mit mailboxOnly=true stattdessen die unzugeordneten E-Mails im Postfach.",
	inputSchema: buildInputSchema({
		ticketId: { type: "string", nullable: true },
		mailboxOnly: { type: "boolean", nullable: true },
	}),
	handler: (args) => {
		const input = coerceArgs({ ticketId: { type: "string", nullable: true }, mailboxOnly: { type: "boolean", nullable: true } }, args);
		if (input.mailboxOnly) return listMailboxMessages();
		if (!input.ticketId) throw new McpToolError("Bitte ticketId angeben oder mailboxOnly=true setzen.");
		return listTicketMessages(input.ticketId as string);
	},
});

registerTool({
	name: "tickets_add_note",
	description: "Fügt eine interne Notiz zum Verlauf eines Tickets hinzu (kein E-Mail-Versand).",
	inputSchema: buildInputSchema({
		ticketId: { type: "string" },
		body: { type: "string", description: "Notiztext" },
	}),
	handler: (args) => {
		const input = coerceArgs({ ticketId: { type: "string" }, body: { type: "string" } }, args);
		const ticketId = input.ticketId as string;
		if (!findTicket(ticketId)) throw new McpToolError(`Ticket mit ID "${ticketId}" wurde nicht gefunden.`);
		const message = createTicketMessage({ ticketId, direction: "NOTE", bodyText: input.body as string });
		return { success: true, id: message.id };
	},
});

registerTool({
	name: "tickets_send_email",
	description:
		"Versendet eine E-Mail-Antwort aus einem Ticket heraus (erfordert konfiguriertes SMTP) und legt sie im Ticket-Verlauf ab. Der Betreff erhält automatisch die Ticket-Kennung (z. B. [#a3f8b2c1]); Antworten des Empfängers werden per Threading (In-Reply-To/References) oder über diese Kennung beim nächsten IMAP-Abruf automatisch dem Ticket zugeordnet.",
	inputSchema: buildInputSchema({
		ticketId: { type: "string" },
		to: { type: "string", description: "Empfängeradresse" },
		subject: { type: "string" },
		body: { type: "string", description: "Nachrichtentext (Klartext)" },
	}),
	handler: async (args) => {
		const input = coerceArgs(
			{ ticketId: { type: "string" }, to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } },
			args
		);
		const ticketId = input.ticketId as string;
		if (!findTicket(ticketId)) throw new McpToolError(`Ticket mit ID "${ticketId}" wurde nicht gefunden.`);
		try {
			await sendTicketEmail({
				ticketId,
				to: input.to as string,
				subject: input.subject as string,
				body: input.body as string,
				authorUserId: null,
				authorEmail: null,
			});
		} catch (error) {
			throw new McpToolError(`E-Mail-Versand fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
		}
		return { success: true, ticketId };
	},
});

registerTool({
	name: "postfach_list",
	description: "Listet die eingehenden, noch keinem Ticket zugeordneten E-Mails im Postfach (neueste zuerst).",
	inputSchema: buildInputSchema({}),
	handler: () => listMailboxMessages(),
});

registerTool({
	name: "postfach_sync",
	description: "Ruft das IMAP-Postfach jetzt ab und importiert neue E-Mails (erfordert konfiguriertes IMAP).",
	inputSchema: buildInputSchema({}),
	handler: async () => {
		const { syncImapMailbox } = await import("@/lib/email/imap-sync");
		const result = await syncImapMailbox();
		if (result.error) throw new McpToolError(`IMAP-Abruf fehlgeschlagen: ${result.error}`);
		return result;
	},
});

registerTool({
	name: "postfach_convert",
	description: "Wandelt eine Postfach-E-Mail in ein neues Ticket um (Status OPEN) und ordnet die E-Mail dem Ticket als ersten Verlauf-Eintrag zu.",
	inputSchema: buildInputSchema({
		messageId: { type: "string", description: "ID der E-Mail im Postfach" },
		propertyId: { type: "string", nullable: true, description: "ID der Liegenschaft (optional, null = Ticket ohne Objektbezug)" },
		unitId: { type: "string", nullable: true, description: "ID der Einheit (optional)" },
		title: { type: "string", description: "Titel des Tickets (z. B. Betreff der E-Mail)" },
		description: { type: "string", nullable: true },
	}),
	handler: (args) => {
		const input = coerceArgs(
			{
				messageId: { type: "string" },
				propertyId: { type: "string", nullable: true },
				unitId: { type: "string", nullable: true },
				title: { type: "string" },
				description: { type: "string", nullable: true },
			},
			args
		);
		const message = getTicketMessage(input.messageId as string);
		if (!message || message.direction !== "INBOUND") throw new McpToolError("Die E-Mail wurde nicht gefunden.");
		if (message.ticketId) throw new McpToolError("Diese E-Mail ist bereits einem Ticket zugeordnet.");
		if (input.propertyId && !getProperty(input.propertyId as string)) throw new McpToolError("Die angegebene Liegenschaft existiert nicht.");
		if (input.unitId && !getUnit(input.unitId as string)) throw new McpToolError("Die angegebene Einheit existiert nicht.");
		const propertyId = (input.propertyId as string) ?? null;
		return convertMessageToTicket(message.id, {
			propertyId,
			// Eine Einheit ist nur mit Liegenschaft sinnvoll.
			unitId: propertyId ? ((input.unitId as string) ?? null) : null,
			title: input.title as string,
			description: (input.description as string) ?? null,
			status: "OPEN",
			contractorNotes: null,
			resolvedAt: null,
		});
	},
});

registerTool({
	name: "postfach_link",
	description: "Ordnet eine Postfach-E-Mail einem bestehenden Ticket zu (erscheint dann in dessen Verlauf).",
	inputSchema: buildInputSchema({
		messageId: { type: "string", description: "ID der E-Mail im Postfach" },
		ticketId: { type: "string" },
	}),
	handler: (args) => {
		const input = coerceArgs({ messageId: { type: "string" }, ticketId: { type: "string" } }, args);
		const message = getTicketMessage(input.messageId as string);
		if (!message || message.direction !== "INBOUND") throw new McpToolError("Die E-Mail wurde nicht gefunden.");
		if (message.ticketId) throw new McpToolError("Diese E-Mail ist bereits einem Ticket zugeordnet.");
		const ticketId = input.ticketId as string;
		if (!findTicket(ticketId)) throw new McpToolError(`Ticket mit ID "${ticketId}" wurde nicht gefunden.`);
		linkMessageToTicket(message.id, ticketId);
		return { success: true, id: message.id, ticketId };
	},
});

registerTool({
	name: "postfach_delete",
	description:
		"Löscht eine E-Mail aus dem Postfach (nur die lokale Kopie in der App; die Nachricht auf dem IMAP-Server bleibt erhalten). Nur für unzugeordnete eingehende E-Mails.",
	inputSchema: buildInputSchema({
		id: { type: "string", description: "ID der E-Mail im Postfach" },
	}),
	handler: (args) => {
		const input = coerceArgs({ id: { type: "string" } }, args);
		const id = input.id as string;
		if (!getTicketMessage(id)) throw new McpToolError("Die E-Mail wurde nicht gefunden.");
		deleteMailboxMessage(id);
		return { success: true, id };
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
	listFilters: {
		leaseId: { type: "string", nullable: true },
		propertyId: { type: "string", nullable: true, description: "ID der Liegenschaft (alle Verträge ihrer Einheiten)" },
		status: { type: "enum", values: TRANSACTION_STATUS, nullable: true },
	},
	list: (filter) =>
		listTransactions({
			leaseId: (filter.leaseId as string) ?? undefined,
			propertyId: (filter.propertyId as string) ?? undefined,
			status: (filter.status as TransactionInput["status"]) ?? undefined,
		}),
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
	create: (input) => createBillingPeriod(input),
	update: (id, input) => updateBillingPeriod(id, input),
	// Finalisierte Perioden sind nicht mehr bearbeitbar, ihre Löschung bleibt
	// möglich (inkl. aller erzeugten PDFs + Postversand-Protokolle).
	delete: (id) => deleteBillingPeriodWithArtifacts(id),
});

registerTool({
	name: "billing_periods_set_notes",
	description:
		"Setzt die internen Notizen einer Abrechnungsperiode - jederzeit erlaubt, auch nach der Finalisierung " +
		"(die eigentlichen Abrechnungsdaten bleiben gesperrt).",
	inputSchema: buildInputSchema({
		id: { type: "string", description: "ID der Abrechnungsperiode" },
		notes: { type: "string", nullable: true, description: "Interne Anmerkungen (null = leeren)" },
	}),
	handler: (args) => {
		const { id, notes } = coerceArgs({ id: { type: "string" }, notes: { type: "string", nullable: true } }, args);
		const period = getBillingPeriod(id as string);
		if (!period) throw new McpToolError(`Abrechnungsperiode mit ID "${id as string}" wurde nicht gefunden.`);
		updateBillingPeriod(id as string, {
			propertyId: period.propertyId,
			periodFrom: period.periodFrom,
			periodTo: period.periodTo,
			notes: (notes as string | null) ?? null,
		});
		return { success: true, id };
	},
});

const costItemFields: Record<string, FieldSpec> = {
	billingPeriodId: { type: "string", description: "ID der Abrechnungsperiode" },
	label: { type: "string" },
	amount: { type: "decimal", description: "Gesamtbetrag der Position" },
	allocationKey: {
		type: "enum",
		values: ALLOCATION_KEYS,
		description: "Umlageschlüssel (bei DIRECT: directUnitId setzen; bei CUSTOM: customAllocationKeyId setzen)",
	},
	directUnitId: { type: "string", nullable: true, description: "Ziel-Einheit bei allocationKey = DIRECT" },
	customAllocationKeyId: { type: "string", nullable: true, description: "ID des individuellen Umlageschlüssels bei allocationKey = CUSTOM" },
	notes: { type: "string", nullable: true },
};

/** Validiert die CUSTOM-/DIRECT-Felder einer Kostenposition gegen die Periode. */
function validateCostItemReferences(billingPeriodId: string, allocationKey: string, directUnitId: string | null, customAllocationKeyId: string | null): string | null {
	const period = getBillingPeriod(billingPeriodId);
	if (!period) return `Abrechnungsperiode mit ID "${billingPeriodId}" wurde nicht gefunden.`;
	if (allocationKey === "CUSTOM") {
		if (!customAllocationKeyId) return "Bei allocationKey CUSTOM muss customAllocationKeyId gesetzt sein.";
		const customKey = getCustomAllocationKey(customAllocationKeyId);
		if (!customKey) return "Der angegebene individuelle Umlageschlüssel existiert nicht.";
		if (customKey.propertyId !== period.propertyId) {
			return "Der individuelle Umlageschlüssel gehört nicht zu der Liegenschaft dieser Abrechnungsperiode.";
		}
	}
	if (allocationKey === "DIRECT" && !directUnitId) return "Bei allocationKey DIRECT muss directUnitId gesetzt sein.";
	return null;
}

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
		return validateCostItemReferences(input.billingPeriodId, input.allocationKey, input.directUnitId, input.customAllocationKeyId);
	},
	beforeUpdate: (id, input) => {
		const costItem = getCostItem(id);
		if (!costItem) return `Kostenposition mit ID "${id}" wurde nicht gefunden.`;
		try {
			requireBillingPeriodDraft(costItem.billingPeriodId, "geändert");
		} catch (error) {
			return (error as Error).message;
		}
		return validateCostItemReferences(input.billingPeriodId, input.allocationKey, input.directUnitId, input.customAllocationKeyId);
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
	create: (input) =>
		createCostItem({
			billingPeriodId: input.billingPeriodId,
			label: input.label,
			amount: input.amount,
			allocationKey: input.allocationKey,
			directUnitId: input.allocationKey === "DIRECT" ? input.directUnitId : null,
			customAllocationKeyId: input.allocationKey === "CUSTOM" ? input.customAllocationKeyId : null,
			notes: input.notes,
		}),
	update: (id, input) =>
		updateCostItem(id, {
			billingPeriodId: input.billingPeriodId,
			label: input.label,
			amount: input.amount,
			allocationKey: input.allocationKey,
			directUnitId: input.allocationKey === "DIRECT" ? input.directUnitId : null,
			customAllocationKeyId: input.allocationKey === "CUSTOM" ? input.customAllocationKeyId : null,
			notes: input.notes,
		}),
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
		"Einzelabrechnungen (tenant_statements) ein. Danach ist die Periode unveränderlich. Läuft atomar in einer Transaktion. " +
		"Berücksichtigt werden nur tatsächlich geleistete Vorauszahlungen (als bezahlt markierte Sollstellungen).",
	inputSchema: buildInputSchema({ id: { type: "string", description: "ID der Abrechnungsperiode" } }),
	handler: (args) => {
		const { id } = coerceArgs({ id: { type: "string" } }, args);
		const detail = getBillingPeriodDetail(id as string);
		if (!detail) throw new McpToolError(`Abrechnungsperiode mit ID "${id as string}" wurde nicht gefunden.`);
		if (detail.billingPeriod.status !== "DRAFT") throw new McpToolError("Diese Abrechnungsperiode wurde bereits finalisiert.");
		if (detail.costItems.length === 0) throw new McpToolError("Bitte erfassen Sie mindestens eine Kostenposition, bevor Sie finalisieren.");

		// Berechnung identisch zur Server Action finalizeBillingPeriodAction
		// (src/app/(app)/abrechnung/actions.ts) über die reine Funktion
		// calculateBillingResult (src/lib/billing.ts) - inkl. Auflösung der
		// Gewichte individueller Umlageschlüssel über den geteilten Helfer
		// des Repositories.
		const customWeightsByKey = buildCustomAllocationWeightsByKey(
			[...new Set(detail.costItems.map((costItem) => costItem.customAllocationKeyId).filter((keyId): keyId is string => keyId !== null))]
		);
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
				customAllocationWeights: costItem.customAllocationKeyId ? customWeightsByKey.get(costItem.customAllocationKeyId) ?? [] : [],
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
// Frei definierbare Umlageschlüssel (Nebenkostenabrechnung)
// ============================================================

registerCrudTools<CustomAllocationKeyInput>({
	entity: "custom_allocation_keys",
	entityLabel: "Umlageschlüssel (individuell)",
	fields: {
		propertyId: { type: "string", description: "ID der Liegenschaft" },
		label: { type: "string" },
		notes: { type: "string", nullable: true },
	},
	listFilters: { propertyId: { type: "string", description: "ID der Liegenschaft (Pflicht)" } },
	list: (filter) => {
		if (!getProperty(filter.propertyId as string)) throw new McpToolError("Die angegebene Liegenschaft existiert nicht.");
		return listCustomAllocationKeysWithWeights(filter.propertyId as string);
	},
	get: (id) => getCustomAllocationKey(id),
	beforeCreate: (input) => (getProperty(input.propertyId) ? null : "Die angegebene Liegenschaft existiert nicht."),
	beforeUpdate: (id) => {
		const customKey = getCustomAllocationKey(id);
		if (!customKey) return `Umlageschlüssel mit ID "${id}" wurde nicht gefunden.`;
		return null;
	},
	create: (input) => createCustomAllocationKey(input),
	update: (id, input) => updateCustomAllocationKey(id, { label: input.label, notes: input.notes }),
	delete: (id) => deleteCustomAllocationKey(id),
});

registerTool({
	name: "custom_allocation_keys_set_weight",
	description: "Setzt das Gewicht einer Einheit für einen individuellen Umlageschlüssel (Upsert).",
	inputSchema: buildInputSchema({
		customAllocationKeyId: { type: "string" },
		unitId: { type: "string" },
		weight: { type: "float", description: "Gewicht (>= 0)" },
	}),
	handler: (args) => {
		const input = coerceArgs(
			{ customAllocationKeyId: { type: "string" }, unitId: { type: "string" }, weight: { type: "float" } },
			args
		);
		const customKey = getCustomAllocationKey(input.customAllocationKeyId as string);
		if (!customKey) throw new McpToolError(`Umlageschlüssel mit ID "${input.customAllocationKeyId as string}" wurde nicht gefunden.`);
		if (!getUnit(input.unitId as string)) throw new McpToolError("Die angegebene Einheit existiert nicht.");
		upsertCustomAllocationKeyWeight(input.customAllocationKeyId as string, input.unitId as string, input.weight as number);
		return { success: true };
	},
});

// ============================================================
// Buchhaltung: Konten, Banktransaktionen, Buchungszeilen
// ============================================================

registerCrudTools<AccountInput>({
	entity: "accounts",
	entityLabel: "Konto (Buchhaltung)",
	fields: {
		propertyId: { type: "string", description: "ID der Liegenschaft" },
		label: { type: "string", description: "Kontobezeichnung, z. B. \"Gebäudeversicherung\"" },
		notes: { type: "string", nullable: true },
	},
	listFilters: { propertyId: { type: "string", description: "ID der Liegenschaft (Pflicht)" } },
	list: (filter) => {
		if (!getProperty(filter.propertyId as string)) throw new McpToolError("Die angegebene Liegenschaft existiert nicht.");
		return listAccountsWithStats(filter.propertyId as string);
	},
	get: (id) => getAccount(id),
	beforeCreate: (input) => (getProperty(input.propertyId) ? null : "Die angegebene Liegenschaft existiert nicht."),
	beforeUpdate: (id) => {
		const account = getAccount(id);
		if (!account) return `Konto mit ID "${id}" wurde nicht gefunden.`;
		return null;
	},
	beforeDelete: (id) => {
		const account = getAccount(id);
		if (!account) return `Konto mit ID "${id}" wurde nicht gefunden.`;
		if (countAllocationsForAccount(id) > 0) return "Dieses Konto hat bereits Buchungen und kann daher nicht gelöscht werden.";
		return null;
	},
	create: (input) => createAccount(input),
	update: (id, input) => updateAccount(id, { label: input.label, notes: input.notes }),
	delete: (id) => deleteAccount(id),
});

const bankTransactionFields: Record<string, FieldSpec> = {
	propertyId: { type: "string", description: "ID der Liegenschaft (Bankkonto)" },
	bookingDate: { type: "date", description: "Buchungsdatum laut Kontoauszug" },
	amount: { type: "decimal", description: "Betrag signed: positiv = Eingang (Gutschrift), negativ = Ausgang (Belastung)" },
	description: { type: "string", description: "Beschreibung/Verwendungszweck laut Kontoauszug" },
	partner: { type: "string", nullable: true, description: "Zahlungspartner" },
	notes: { type: "string", nullable: true },
};

registerCrudTools<BankTransactionInput>({
	entity: "bank_transactions",
	entityLabel: "Banktransaktion",
	fields: bankTransactionFields,
	listFilters: {
		propertyId: { type: "string", nullable: true },
		status: {
			type: "enum",
			values: BANK_TRANSACTION_STATUS,
			nullable: true,
			description: "Abgeleiteter Zuordnungsstatus (OPEN = nichts zugeordnet, PARTIAL = teilweise, RECONCILED = vollständig)",
		},
	},
	list: (filter) =>
		listBankTransactions({
			propertyId: (filter.propertyId as string) ?? undefined,
			status: (filter.status as "OPEN" | "PARTIAL" | "RECONCILED") ?? undefined,
		}),
	get: (id) => getBankTransaction(id),
	beforeCreate: (input) => (getProperty(input.propertyId) ? null : "Die angegebene Liegenschaft existiert nicht."),
	beforeUpdate: (_id, input) => (getProperty(input.propertyId) ? null : "Die angegebene Liegenschaft existiert nicht."),
	create: (input) => createBankTransaction(input),
	update: (id, input) => updateBankTransaction(id, input),
	delete: (id) => deleteBankTransaction(id),
});

registerTool({
	name: "bank_transactions_allocate",
	description:
		"Ersetzt SÄMTLICHE Buchungszeilen einer Banktransaktion: ordnet Teilbeträge (Split möglich) Konten " +
		"(accountId, z. B. Gebäudeversicherung), fälligen Miet-Sollstellungen (transactionId, Mieteingänge) oder " +
		"Hausgeld-Sollstellungen der WEG-Verwaltung (housingChargeId) zu. Vollständig zugeordnete Sollstellungen " +
		"beider Buchungskreise gelten als bezahlt (Status PAID inkl. Zahldatum). " +
		"Der Zuordnungsstatus der Banktransaktion (offen/teilweise/zugeordnet) wird daraus abgeleitet.",
	inputSchema: {
		type: "object",
		properties: {
			id: { type: "string", description: "ID der Banktransaktion" },
			allocations: {
				type: "array",
				items: {
					type: "object",
					properties: {
						accountId: { type: ["string", "null"], description: "Ziel-Konto (genau eines von accountId/transactionId/housingChargeId je Zeile)" },
						transactionId: { type: ["string", "null"], description: "Ziel-Sollstellung (Mieteingang)" },
						housingChargeId: { type: ["string", "null"], description: "Ziel-Hausgeld-Sollstellung (WEG-Verwaltung)" },
						amount: { type: ["string", "number"], description: "Teilbetrag, gleiches Vorzeichen wie die Banktransaktion (Dezimal, Komma erlaubt)" },
					},
					required: ["amount"],
				},
				description: "Buchungszeilen (leeres Array = Zuordnung entfernen)",
			},
		},
		required: ["id"],
		additionalProperties: false,
	},
	handler: (args) => {
		if (typeof args !== "object" || args === null || Array.isArray(args)) throw new McpToolError("Die Argumente müssen ein JSON-Objekt sein.");
		const { id, allocations } = args as Record<string, unknown>;
		if (typeof id !== "string" || !id) throw new McpToolError('Pflichtfeld "id" fehlt.');
		if (allocations !== undefined && !Array.isArray(allocations)) throw new McpToolError('Feld "allocations" muss ein Array sein.');

		const parsed: BankTransactionAllocationInput[] = ((allocations ?? []) as Record<string, unknown>[]).map((entry) => {
			const coerced = coerceArgs(
				{ accountId: { type: "string", nullable: true }, transactionId: { type: "string", nullable: true }, housingChargeId: { type: "string", nullable: true }, amount: { type: "decimal" } },
				entry ?? {}
			);
			return {
				accountId: (coerced.accountId as string) ?? null,
				transactionId: (coerced.transactionId as string) ?? null,
				housingChargeId: (coerced.housingChargeId as string) ?? null,
				amount: coerced.amount as string,
			};
		});

		const validationError = validateBankAllocations(id, parsed);
		if (validationError) throw new McpToolError(bankAllocationErrorToGermanMessage(validationError, (line) => `Zeile ${line}`));

		setBankTransactionAllocations(id, parsed);
		return { success: true, id, allocations: parsed.length };
	},
});

registerTool({
	name: "bank_transactions_import",
	description:
		"Importiert eine Liste von Banktransaktionen (z. B. aus einem eingelesenen Kontoauszug) inkl. optionaler " +
		"Buchungszeilen in einem Zug. Es werden ALLE Einträge vorab geprüft (gleiche Fachregeln wie " +
		"bank_transactions_allocate) - bei einem Fehler wird nichts angelegt. " +
		"Offene Miet-Sollstellungen der Liegenschaft können über transactions_list (propertyId-Filter) ermittelt " +
		"werden, offene Hausgeld-Sollstellungen der WEG-Verwaltung über housing_charges_list (hoaId-Filter).",
	inputSchema: {
		type: "object",
		properties: {
			propertyId: { type: "string", description: "ID der Liegenschaft (Bankkonto, auf dem die Bewegungen erfasst werden)" },
			transactions: {
				type: "array",
				items: {
					type: "object",
					properties: {
						bookingDate: { type: "string", description: "Buchungsdatum (ISO-8601)" },
						amount: { type: ["string", "number"], description: "Betrag signed: positiv = Eingang, negativ = Ausgang (Dezimal, Komma erlaubt)" },
						description: { type: "string", description: "Beschreibung/Verwendungszweck" },
						partner: { type: ["string", "null"] },
						notes: { type: ["string", "null"] },
						allocations: {
							type: "array",
							items: {
								type: "object",
								properties: {
									accountId: { type: ["string", "null"] },
									transactionId: { type: ["string", "null"] },
									housingChargeId: { type: ["string", "null"], description: "Ziel-Hausgeld-Sollstellung (WEG-Verwaltung)" },
									amount: { type: ["string", "number"] },
								},
								required: ["amount"],
							},
							description: "Optionale Buchungszeilen (wie bei bank_transactions_allocate)",
						},
					},
					required: ["bookingDate", "amount", "description"],
				},
			},
		},
		required: ["propertyId", "transactions"],
		additionalProperties: false,
	},
	handler: (args) => {
		if (typeof args !== "object" || args === null || Array.isArray(args)) throw new McpToolError("Die Argumente müssen ein JSON-Objekt sein.");
		const { propertyId, transactions } = args as Record<string, unknown>;
		if (typeof propertyId !== "string" || !propertyId) throw new McpToolError('Pflichtfeld "propertyId" fehlt.');
		if (!getProperty(propertyId)) throw new McpToolError("Die angegebene Liegenschaft existiert nicht.");
		if (!Array.isArray(transactions)) throw new McpToolError('Pflichtfeld "transactions" muss ein Array sein.');
		if (transactions.length === 0) throw new McpToolError("Die Liste der Banktransaktionen ist leer.");
		if (transactions.length > MAX_BANK_TRANSACTION_IMPORT) {
			throw new McpToolError(`Es können maximal ${MAX_BANK_TRANSACTION_IMPORT} Banktransaktionen pro Aufruf importiert werden.`);
		}

		// Alle Einträge VOR dem Anlegen normalisieren und prüfen (fail-fast:
		// bei einem Fehler wird nichts angelegt).
		const prepared: { input: BankTransactionInput; allocations: BankTransactionAllocationInput[] }[] = [];
		for (const [index, rawEntry] of (transactions as Record<string, unknown>[]).entries()) {
			// "allocations" ist kein Stammfeld - coerceArgs prüft gegen die
			// Feld-Spezifikation und lehnt unbekannte Felder ab, deshalb wird
			// es vorab abgetrennt.
			const { allocations: rawAllocations, ...entry } = rawEntry ?? {};
			const coerced = coerceArgs(
				{
					bookingDate: { type: "date" },
					amount: { type: "decimal", description: "signed" },
					description: { type: "string" },
					partner: { type: "string", nullable: true },
					notes: { type: "string", nullable: true },
				},
				entry
			);
			const input: BankTransactionInput = {
				propertyId,
				bookingDate: coerced.bookingDate as string,
				amount: coerced.amount as string,
				description: coerced.description as string,
				partner: (coerced.partner as string) ?? null,
				notes: (coerced.notes as string) ?? null,
			};

			if (rawAllocations !== undefined && rawAllocations !== null && !Array.isArray(rawAllocations)) {
				throw new McpToolError(`Eintrag ${index + 1}: "allocations" muss ein Array sein.`);
			}
			const allocations: BankTransactionAllocationInput[] = ((rawAllocations ?? []) as Record<string, unknown>[]).map((allocationEntry) => {
				const allocationCoerced = coerceArgs(
					{ accountId: { type: "string", nullable: true }, transactionId: { type: "string", nullable: true }, housingChargeId: { type: "string", nullable: true }, amount: { type: "decimal" } },
					allocationEntry ?? {}
				);
				return {
					accountId: (allocationCoerced.accountId as string) ?? null,
					transactionId: (allocationCoerced.transactionId as string) ?? null,
					housingChargeId: (allocationCoerced.housingChargeId as string) ?? null,
					amount: allocationCoerced.amount as string,
				};
			});

			prepared.push({ input, allocations });
		}

		// Vorab-Validierung der Buchungszeilen gegen die GEPLANTEN Werte
		// (die Banktransaktionen existieren noch nicht) - geteilte Regeln
		// aus src/lib/bank-allocations.ts, identisch zum allocate-Werkzeug.
		for (const [index, { input, allocations }] of prepared.entries()) {
			if (allocations.length === 0) continue;
			const validationError = validateBankAllocationsAgainst(input, allocations);
			if (validationError) {
				throw new McpToolError(bankAllocationErrorToGermanMessage(validationError, (line) => `Eintrag ${index + 1}, Zeile ${line}`));
			}
		}

		const createdIds: string[] = [];
		for (const { input, allocations } of prepared) {
			const bankTransaction = createBankTransaction(input);
			createdIds.push(bankTransaction.id);
			if (allocations.length > 0) setBankTransactionAllocations(bankTransaction.id, allocations);
		}

		return { success: true, created: createdIds.length, ids: createdIds };
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
