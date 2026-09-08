import {
	createAnnualStatement,
	createHoaCostItem,
	deleteAnnualStatement,
	deleteHoaCostItem,
	finalizeAnnualStatement,
	getAnnualStatement,
	getAnnualStatementDetail,
	getHoaCostItem,
	listAnnualStatements,
	listCustomAllocationKeyWeights as listCustomAllocationKeyWeightsForStatement,
	listHousingChargesForUnits as listPlainHousingChargesForUnits,
	saveHoaConsumptionValuesForCostItem,
	updateAnnualStatement,
	updateHoaCostItem,
	type AnnualStatementInput,
	type HoaCostItemInput,
} from "@/data/annual-statements";
import {
	createEconomicPlan,
	createEconomicPlanCostItem,
	deleteEconomicPlan,
	deleteEconomicPlanCostItem,
	finalizeEconomicPlan,
	generateHousingCharges,
	getEconomicPlan,
	getEconomicPlanDetail,
	listCustomAllocationKeyWeights as listCustomAllocationKeyWeightsForPlan,
	listEconomicPlans,
	listEconomicPlanUnitShares,
	listUnitOwnershipsForUnits,
	updateEconomicPlan,
	updateEconomicPlanCostItem,
	type DueHousingChargeCandidate,
	type EconomicPlanCostItemInput,
	type EconomicPlanInput,
} from "@/data/economic-plans";
import {
	createCustomAllocationKey,
	deleteCustomAllocationKey,
	listCustomAllocationKeysWithWeights,
	listUnitsForHoa,
	updateCustomAllocationKey,
	upsertCustomAllocationKeyWeight,
	type CustomAllocationKeyInput,
} from "@/data/hoa-allocation-keys";
import { createHoa, deleteHoa, listAvailablePropertiesForHoa, listHoasWithProperty, updateHoa, type HoaInput } from "@/data/hoas";
import {
	createHousingCharge,
	deleteHousingCharge,
	listHousingChargesForUnits,
	markHousingChargePaid,
	updateHousingCharge,
	type HousingChargeInput,
} from "@/data/housing-charges";
import {
	createOwnerMeeting,
	createAgendaItem,
	deleteAgendaItem,
	deleteOwnerMeeting,
	deleteResolution,
	getOwnerMeeting,
	getOwnerResolution,
	listAgendaItemsForMeeting,
	listOwnerMeetings,
	listOwnerResolutions,
	listResolutionSequenceNumbersForHoa,
	countResolutionsForMeeting,
	createResolution,
	updateAgendaItem,
	updateOwnerMeeting,
	updateOwnerMeetingMinutesText,
	updateResolution,
	type AgendaItemInput,
	type OwnerMeetingInput,
	type OwnerResolutionInput,
} from "@/data/meetings";
import { createOwner, deleteOwner, getOwner, listOwners, updateOwner, type OwnerInput } from "@/data/owners";
import { getProperty } from "@/data/properties";
import {
	getHoa,
	listHoasSortedByName,
	listHousingChargeAmountsForHoa,
	listReserveFundBookings,
	createReserveFundBooking,
	deleteReserveFundBooking,
	updateReserveFundBooking,
	type ReserveFundBookingInput,
} from "@/data/reserve-fund";
import {
	createUnitOwnership,
	deleteUnitOwnership,
	getOpenUnitOwnership,
	listUnitsWithOwnerships,
	setUnitOwnershipEndDate,
	updateUnitOwnership,
	type UnitOwnershipInput,
} from "@/data/unit-ownerships";
import { getUnit } from "@/data/units";
import { calculateAnnualStatementResult } from "@/lib/hoa-annual-statement";
import { calculateEconomicPlanResult } from "@/lib/hoa-economic-plan";
import { calculateContestationDeadline } from "@/lib/hoa-meetings";
import { findOwnershipForDate } from "@/lib/hoa-ownership";
import { calculateHoaWealthReport } from "@/lib/hoa-reserve";
import { centsToDecimalString } from "@/lib/money";

import { McpToolError, buildInputSchema, coerceArgs, registerCrudTools, registerTool, type FieldSpec } from "./registry";

/**
 * MCP-Werkzeuge der WEG-Verwaltung (WEGs, Eigentümer, Eigentumsverhältnisse,
 * Verteilerschlüssel, Wirtschaftsplan, Jahresabrechnung, Hausgeld,
 * Erhaltungsrücklage, Versammlungen/Beschluss-Sammlung). Fachregeln
 * (Entwurfs-Sperren, automatische Beschlussnummer + Anfechtungsfrist,
 * Eigentümerwechsel-Versionierung) spiegeln die Server Actions der App.
 */

const HOA_ALLOCATION_KEYS = ["MEA", "LIVING_SPACE", "UNITS", "CONSUMPTION", "DIRECT", "CUSTOM"] as const;
const HOA_COST_CATEGORIES = [
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
] as const;
const RESERVE_BOOKING_TYPES = ["CONTRIBUTION", "WITHDRAWAL"] as const;
const HOUSING_CHARGE_STATUS = ["OPEN", "PAID", "OVERDUE", "CANCELLED"] as const;
const MEETING_TYPES = ["ORDINARY", "EXTRAORDINARY", "CIRCULATION"] as const;
const MEETING_STATUS = ["PLANNED", "INVITED", "HELD", "MINUTES_FINALIZED", "CANCELLED"] as const;
const VOTING_RESULTS = ["ACCEPTED", "REJECTED"] as const;

function requireHoa(hoaId: string): void {
	if (!getHoa(hoaId)) throw new McpToolError(`WEG mit ID "${hoaId}" wurde nicht gefunden.`);
}

// ============================================================
// WEGs und Eigentümer
// ============================================================

registerCrudTools<HoaInput>({
	entity: "hoas",
	entityLabel: "WEG",
	fields: {
		propertyId: { type: "string", description: "ID der Liegenschaft (1:1-Bindung, nur freie Liegenschaften)" },
		name: { type: "string" },
		totalShares: { type: "int", description: "Nenner der Miteigentumsanteile (z. B. 1000)" },
		bankIban: { type: "string", nullable: true },
		bankBic: { type: "string", nullable: true },
		notes: { type: "string", nullable: true },
	},
	list: () => listHoasWithProperty(),
	get: (id) => getHoa(id),
	beforeCreate: (input) => {
		if (!getProperty(input.propertyId)) return "Die angegebene Liegenschaft existiert nicht.";
		if (!listAvailablePropertiesForHoa().some((property) => property.id === input.propertyId)) {
			return "Diese Liegenschaft ist bereits einer WEG zugeordnet (1:1-Bindung).";
		}
		return null;
	},
	create: (input) => createHoa(input),
	update: (id, input) => updateHoa(id, input),
	delete: (id) => deleteHoa(id),
});

registerCrudTools<OwnerInput>({
	entity: "owners",
	entityLabel: "Eigentümer",
	fields: {
		firstName: { type: "string" },
		lastName: { type: "string" },
		isCompany: { type: "boolean", description: "true = juristische Person (dann companyName setzen)" },
		companyName: { type: "string", nullable: true },
		street: { type: "string" },
		zipCode: { type: "string" },
		city: { type: "string" },
		country: { type: "string" },
		email: { type: "string", nullable: true },
		phone: { type: "string", nullable: true },
		notes: { type: "string", nullable: true },
	},
	list: () => listOwners(),
	get: (id) => getOwner(id),
	create: (input) => createOwner(input),
	update: (id, input) => updateOwner(id, input),
	delete: (id) => deleteOwner(id),
});

// ============================================================
// Eigentumsverhältnisse (zeitversioniert)
// ============================================================

const ownershipFields: Record<string, FieldSpec> = {
	unitId: { type: "string", description: "ID der Einheit" },
	ownerId: { type: "string", description: "ID des Eigentümers" },
	coOwnerId: { type: "string", nullable: true, description: "ID des Miteigentümers (optional, nicht identisch mit ownerId)" },
	startDate: { type: "date", description: "Beginn des Eigentums" },
	notes: { type: "string", nullable: true },
};

registerTool({
	name: "unit_ownerships_list",
	description: "Listet Einheiten von WEG-Liegenschaften inkl. ihrer zeitversionierten Eigentumsverhältnisse (optional auf eine WEG eingeschränkt).",
	inputSchema: buildInputSchema({ hoaId: { type: "string", nullable: true } }),
	handler: (args) => {
		const { hoaId } = coerceArgs({ hoaId: { type: "string", nullable: true } }, args);
		if (hoaId) requireHoa(hoaId as string);
		return listUnitsWithOwnerships((hoaId as string) ?? undefined);
	},
});

registerTool({
	name: "unit_ownerships_create",
	description:
		"Legt ein neues Eigentumsverhältnis an (Eigentümerwechsel). Ein bisher laufendes Verhältnis derselben Einheit " +
		"wird automatisch am Vortag des neuen Beginns beendet.",
	inputSchema: buildInputSchema(ownershipFields),
	handler: (args) => {
		const input = coerceArgs(ownershipFields, args) as unknown as UnitOwnershipInput;
		if (!getUnit(input.unitId)) throw new McpToolError("Die angegebene Einheit existiert nicht.");
		if (!getOwner(input.ownerId)) throw new McpToolError("Der angegebene Eigentümer existiert nicht.");
		if (input.coOwnerId) {
			if (!getOwner(input.coOwnerId)) throw new McpToolError("Der angegebene Miteigentümer existiert nicht.");
			if (input.coOwnerId === input.ownerId) throw new McpToolError("Eigentümer und Miteigentümer dürfen nicht identisch sein.");
		}

		const startDate = new Date(input.startDate);
		const previousOpen = getOpenUnitOwnership(input.unitId);
		if (previousOpen) {
			if (new Date(previousOpen.startDate) >= startDate) {
				throw new McpToolError("Das Beginn-Datum muss nach dem Beginn des aktuell laufenden Eigentumsverhältnisses dieser Einheit liegen.");
			}
			const endDate = new Date(startDate);
			endDate.setDate(endDate.getDate() - 1);
			setUnitOwnershipEndDate(previousOpen.id, endDate.toISOString());
		}
		return createUnitOwnership(input);
	},
});

registerTool({
	name: "unit_ownerships_update",
	description: "Aktualisiert ein Eigentumsverhältnis (vollständiger Ersatz der Felder).",
	inputSchema: buildInputSchema({ id: { type: "string" }, ...ownershipFields }),
	handler: (args) => {
		const { id } = coerceArgs({ id: { type: "string" } }, args);
		const { id: _ignored, ...rest } = args as Record<string, unknown>;
		const input = coerceArgs(ownershipFields, rest) as unknown as UnitOwnershipInput;
		if (input.coOwnerId && input.coOwnerId === input.ownerId) {
			throw new McpToolError("Eigentümer und Miteigentümer dürfen nicht identisch sein.");
		}
		updateUnitOwnership(id as string, input);
		return { success: true, id };
	},
});

registerTool({
	name: "unit_ownerships_end",
	description: "Setzt das Enddatum eines Eigentumsverhältnisses (z. B. bei Verkauf).",
	inputSchema: buildInputSchema({ id: { type: "string" }, endDate: { type: "date" } }),
	handler: (args) => {
		const input = coerceArgs({ id: { type: "string" }, endDate: { type: "date" } }, args);
		setUnitOwnershipEndDate(input.id as string, input.endDate as string);
		return { success: true, id: input.id };
	},
});

registerTool({
	name: "unit_ownerships_delete",
	description: "Löscht ein Eigentumsverhältnis unwiderruflich.",
	inputSchema: buildInputSchema({ id: { type: "string" } }),
	handler: (args) => {
		const { id } = coerceArgs({ id: { type: "string" } }, args);
		deleteUnitOwnership(id as string);
		return { success: true, id };
	},
});

// ============================================================
// Frei definierbare Verteilerschlüssel
// ============================================================

registerCrudTools<CustomAllocationKeyInput>({
	entity: "hoa_allocation_keys",
	entityLabel: "Verteilerschlüssel (frei definierbar)",
	fields: {
		hoaId: { type: "string", description: "ID der WEG" },
		label: { type: "string" },
		notes: { type: "string", nullable: true },
	},
	listFilters: { hoaId: { type: "string", description: "ID der WEG (Pflicht)" } },
	list: (filter) => {
		requireHoa(filter.hoaId as string);
		return listCustomAllocationKeysWithWeights(filter.hoaId as string);
	},
	beforeCreate: (input) => {
		try {
			requireHoa(input.hoaId);
		} catch (error) {
			return (error as Error).message;
		}
		return null;
	},
	create: (input) => createCustomAllocationKey(input),
	update: (id, input) => updateCustomAllocationKey(id, { label: input.label, notes: input.notes }),
	delete: (id) => deleteCustomAllocationKey(id),
});

registerTool({
	name: "hoa_allocation_keys_set_weight",
	description: "Setzt das Gewicht einer Einheit für einen frei definierbaren Verteilerschlüssel (Upsert).",
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
		if (!getUnit(input.unitId as string)) throw new McpToolError("Die angegebene Einheit existiert nicht.");
		upsertCustomAllocationKeyWeight(input.customAllocationKeyId as string, input.unitId as string, input.weight as number);
		return { success: true };
	},
});

// ============================================================
// Wirtschaftsplan
// ============================================================

registerCrudTools<EconomicPlanInput>({
	entity: "economic_plans",
	entityLabel: "Wirtschaftsplan",
	fields: {
		hoaId: { type: "string", description: "ID der WEG" },
		fiscalYearFrom: { type: "date", description: "Beginn des Geschäftsjahrs" },
		fiscalYearTo: { type: "date", description: "Ende des Geschäftsjahrs" },
		notes: { type: "string", nullable: true },
	},
	listFilters: { hoaId: { type: "string", nullable: true } },
	list: (filter) => listEconomicPlans(filter.hoaId ? { hoaId: filter.hoaId as string } : undefined),
	get: (id) => getEconomicPlanDetail(id),
	beforeCreate: (input) => {
		try {
			requireHoa(input.hoaId);
		} catch (error) {
			return (error as Error).message;
		}
		return null;
	},
	beforeUpdate: (id, input) => {
		const plan = getEconomicPlan(id);
		if (!plan) return `Wirtschaftsplan mit ID "${id}" wurde nicht gefunden.`;
		if (plan.status !== "DRAFT") return "Der Wirtschaftsplan ist bereits finalisiert und kann nicht mehr geändert werden.";
		if (!getHoa(input.hoaId)) return "Die angegebene WEG existiert nicht.";
		return null;
	},
	beforeDelete: (id) => {
		const plan = getEconomicPlan(id);
		if (plan && plan.status !== "DRAFT") return "Nur Wirtschaftspläne im Entwurfsstatus können gelöscht werden.";
		return null;
	},
	create: (input) => createEconomicPlan(input),
	update: (id, input) => updateEconomicPlan(id, input),
	delete: (id) => deleteEconomicPlan(id),
});

const economicPlanCostItemFields: Record<string, FieldSpec> = {
	economicPlanId: { type: "string", description: "ID des Wirtschaftsplans" },
	category: { type: "enum", values: HOA_COST_CATEGORIES },
	label: { type: "string" },
	amount: { type: "decimal", description: "Geplanter Jahresbetrag" },
	allocationKey: { type: "enum", values: HOA_ALLOCATION_KEYS, description: "Bei CUSTOM: customAllocationKeyId setzen; bei DIRECT: directUnitId" },
	directUnitId: { type: "string", nullable: true },
	customAllocationKeyId: { type: "string", nullable: true },
	notes: { type: "string", nullable: true },
};

function requireEconomicPlanDraft(planId: string): void {
	const plan = getEconomicPlan(planId);
	if (!plan) throw new McpToolError(`Wirtschaftsplan mit ID "${planId}" wurde nicht gefunden.`);
	if (plan.status !== "DRAFT") throw new McpToolError("Der Wirtschaftsplan ist bereits finalisiert und kann nicht mehr geändert werden.");
}

registerTool({
	name: "economic_plan_cost_items_create",
	description: "Fügt eine Kostenposition zu einem Wirtschaftsplan hinzu (nur im Entwurfsstatus).",
	inputSchema: buildInputSchema(economicPlanCostItemFields),
	handler: (args) => {
		const input = coerceArgs(economicPlanCostItemFields, args) as unknown as EconomicPlanCostItemInput & { economicPlanId: string };
		requireEconomicPlanDraft(input.economicPlanId);
		const { economicPlanId, ...item } = input;
		return createEconomicPlanCostItem(economicPlanId, item);
	},
});

registerTool({
	name: "economic_plan_cost_items_update",
	description: "Aktualisiert eine Kostenposition eines Wirtschaftsplans (nur im Entwurfsstatus).",
	inputSchema: buildInputSchema({ id: { type: "string" }, ...economicPlanCostItemFields }),
	handler: (args) => {
		const { id } = coerceArgs({ id: { type: "string" } }, args);
		const { id: _ignored, ...rest } = args as Record<string, unknown>;
		const input = coerceArgs(economicPlanCostItemFields, rest) as unknown as EconomicPlanCostItemInput & { economicPlanId: string };
		requireEconomicPlanDraft(input.economicPlanId);
		const { economicPlanId, ...item } = input;
		updateEconomicPlanCostItem(id as string, economicPlanId, item);
		return { success: true, id };
	},
});

registerTool({
	name: "economic_plan_cost_items_delete",
	description: "Löscht eine Kostenposition (nur solange Plan bzw. Abrechnung im Entwurfsstatus ist).",
	inputSchema: buildInputSchema({ id: { type: "string" } }),
	handler: (args) => {
		const { id } = coerceArgs({ id: { type: "string" } }, args);
		const item = getHoaCostItem(id as string);
		if (!item) throw new McpToolError(`Kostenposition mit ID "${id as string}" wurde nicht gefunden.`);
		if (item.economicPlanId) requireEconomicPlanDraft(item.economicPlanId);
		deleteEconomicPlanCostItem(id as string);
		return { success: true, id };
	},
});

registerTool({
	name: "economic_plans_finalize",
	description:
		"Berechnet die Einzelwirtschaftspläne je Einheit und friert den Wirtschaftsplan dauerhaft ein " +
		"(atomare Transaktion). Danach können die monatlichen Hausgeld-Sollstellungen generiert werden.",
	inputSchema: buildInputSchema({ id: { type: "string", description: "ID des Wirtschaftsplans" } }),
	handler: (args) => {
		const { id } = coerceArgs({ id: { type: "string" } }, args);
		const detail = getEconomicPlanDetail(id as string);
		if (!detail) throw new McpToolError(`Wirtschaftsplan mit ID "${id as string}" wurde nicht gefunden.`);
		if (detail.plan.status !== "DRAFT") throw new McpToolError("Dieser Wirtschaftsplan wurde bereits finalisiert.");
		if (detail.costItems.length === 0) throw new McpToolError("Bitte erfassen Sie mindestens eine Kostenposition, bevor Sie finalisieren.");
		if (detail.units.length === 0) throw new McpToolError("Diese Liegenschaft hat noch keine Einheiten.");

		// Berechnung identisch zur Server Action finalizeEconomicPlanAction
		// (src/app/(app)/weg/wirtschaftsplan/actions.ts).
		const customKeyIds = [...new Set(detail.costItems.map((item) => item.customAllocationKeyId).filter((keyId): keyId is string => keyId !== null))];
		const customWeights = listCustomAllocationKeyWeightsForPlan(customKeyIds);
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
			costItems: detail.costItems.map((item) => ({
				id: item.id,
				amount: item.amount,
				allocationKey: item.allocationKey,
				directUnitId: item.directUnitId,
				customAllocationWeights: item.customAllocationKeyId ? customWeightsByKey.get(item.customAllocationKeyId) ?? [] : [],
			})),
		});

		finalizeEconomicPlan(
			id as string,
			result.unitShares.map((share) => ({ unitId: share.unitId, annualAmount: share.annualAmount, monthlyAmount: share.monthlyAmount }))
		);
		return { success: true, id, unitShares: result.unitShares.length };
	},
});

registerTool({
	name: "economic_plans_generate_housing_charges",
	description:
		"Stellt für jeden Monat des Geschäftsjahrs und jede Einheit das monatliche Hausgeld (aus dem finalisierten " +
		"Wirtschaftsplan) fällig. Der Eigentümer wird je Monat anhand des gültigen Eigentumsverhältnisses ermittelt; " +
		"Duplikate werden übersprungen.",
	inputSchema: buildInputSchema({
		economicPlanId: { type: "string" },
		dueDay: { type: "int", description: "Fälligkeitstag im Monat (1-28)" },
	}),
	handler: (args) => {
		const input = coerceArgs({ economicPlanId: { type: "string" }, dueDay: { type: "int" } }, args);
		const dueDay = input.dueDay as number;
		if (dueDay < 1 || dueDay > 28) throw new McpToolError("Der Fälligkeitstag muss zwischen 1 und 28 liegen.");

		const economicPlanId = input.economicPlanId as string;
		const plan = getEconomicPlan(economicPlanId);
		if (!plan) throw new McpToolError("Der Wirtschaftsplan wurde nicht gefunden.");
		if (plan.status !== "FINALIZED") {
			throw new McpToolError("Hausgeld kann erst fällig gestellt werden, wenn der Wirtschaftsplan finalisiert wurde.");
		}

		// Identisch zur Server Action generateHousingChargesAction
		// (src/app/(app)/weg/wirtschaftsplan/actions.ts).
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
				candidates.push({
					unitId: share.unitId,
					ownerId: ownership.ownerId,
					economicPlanId,
					amount: share.monthlyAmount,
					dueDate: dueDate.toISOString(),
					purpose: `Hausgeld ${month + 1}/${year}`,
					monthStart: new Date(year, month, 1).toISOString(),
					monthEnd: new Date(year, month + 1, 1).toISOString(),
				});
			}
		}

		const result = generateHousingCharges(candidates);
		return { ...result, skippedNoOwner };
	},
});

// ============================================================
// Jahresabrechnung
// ============================================================

registerCrudTools<AnnualStatementInput>({
	entity: "annual_statements",
	entityLabel: "Jahresabrechnung (WEG)",
	fields: {
		hoaId: { type: "string", description: "ID der WEG" },
		periodFrom: { type: "date", description: "Beginn des Abrechnungszeitraums" },
		periodTo: { type: "date", description: "Ende des Abrechnungszeitraums" },
		notes: { type: "string", nullable: true },
	},
	listFilters: { hoaId: { type: "string", nullable: true } },
	list: (filter) => listAnnualStatements(filter.hoaId ? { hoaId: filter.hoaId as string } : undefined),
	get: (id) => getAnnualStatementDetail(id),
	beforeCreate: (input) => {
		try {
			requireHoa(input.hoaId);
		} catch (error) {
			return (error as Error).message;
		}
		return null;
	},
	beforeUpdate: (id, input) => {
		const statement = getAnnualStatement(id);
		if (!statement) return `Jahresabrechnung mit ID "${id}" wurde nicht gefunden.`;
		if (statement.status !== "DRAFT") return "Die Jahresabrechnung ist bereits finalisiert und kann nicht mehr geändert werden.";
		if (!getHoa(input.hoaId)) return "Die angegebene WEG existiert nicht.";
		return null;
	},
	beforeDelete: (id) => {
		const statement = getAnnualStatement(id);
		if (statement && statement.status !== "DRAFT") return "Nur Jahresabrechnungen im Entwurfsstatus können gelöscht werden.";
		return null;
	},
	create: (input) => createAnnualStatement(input),
	update: (id, input) => updateAnnualStatement(id, input),
	delete: (id) => deleteAnnualStatement(id),
});

const statementCostItemFields: Record<string, FieldSpec> = {
	annualStatementId: { type: "string", description: "ID der Jahresabrechnung" },
	category: { type: "enum", values: HOA_COST_CATEGORIES },
	label: { type: "string" },
	amount: { type: "decimal" },
	allocationKey: { type: "enum", values: HOA_ALLOCATION_KEYS, description: "Bei CUSTOM: customAllocationKeyId setzen; bei DIRECT: directUnitId" },
	directUnitId: { type: "string", nullable: true },
	customAllocationKeyId: { type: "string", nullable: true },
	isApportionable: { type: "boolean", description: "Umlagefähig nach BetrKV (relevant für die Übertrag in die Mieter-Nebenkostenabrechnung)" },
	notes: { type: "string", nullable: true },
};

function requireAnnualStatementDraft(statementId: string): void {
	const statement = getAnnualStatement(statementId);
	if (!statement) throw new McpToolError(`Jahresabrechnung mit ID "${statementId}" wurde nicht gefunden.`);
	if (statement.status !== "DRAFT") throw new McpToolError("Die Jahresabrechnung ist bereits finalisiert und kann nicht mehr geändert werden.");
}

registerTool({
	name: "annual_statement_cost_items_create",
	description: "Fügt eine Kostenposition zu einer Jahresabrechnung hinzu (nur im Entwurfsstatus).",
	inputSchema: buildInputSchema(statementCostItemFields),
	handler: (args) => {
		const input = coerceArgs(statementCostItemFields, args) as unknown as Omit<HoaCostItemInput, "context" | "economicPlanId">;
		requireAnnualStatementDraft(input.annualStatementId as string);
		return createHoaCostItem({
			context: "STATEMENT",
			economicPlanId: null,
			annualStatementId: input.annualStatementId,
			category: input.category,
			label: input.label,
			amount: input.amount,
			allocationKey: input.allocationKey,
			directUnitId: input.directUnitId,
			customAllocationKeyId: input.customAllocationKeyId,
			isApportionable: input.isApportionable,
			notes: input.notes,
		});
	},
});

registerTool({
	name: "annual_statement_cost_items_update",
	description: "Aktualisiert eine Kostenposition einer Jahresabrechnung (nur im Entwurfsstatus).",
	inputSchema: buildInputSchema({ id: { type: "string" }, ...statementCostItemFields }),
	handler: (args) => {
		const { id } = coerceArgs({ id: { type: "string" } }, args);
		const { id: _ignored, ...rest } = args as Record<string, unknown>;
		const input = coerceArgs(statementCostItemFields, rest) as unknown as Omit<HoaCostItemInput, "context" | "economicPlanId">;
		requireAnnualStatementDraft(input.annualStatementId as string);
		const existing = getHoaCostItem(id as string);
		if (!existing) throw new McpToolError(`Kostenposition mit ID "${id as string}" wurde nicht gefunden.`);
		updateHoaCostItem(id as string, {
			context: existing.context,
			economicPlanId: existing.economicPlanId,
			annualStatementId: input.annualStatementId,
			category: input.category,
			label: input.label,
			amount: input.amount,
			allocationKey: input.allocationKey,
			directUnitId: input.directUnitId,
			customAllocationKeyId: input.customAllocationKeyId,
			isApportionable: input.isApportionable,
			notes: input.notes,
		});
		return { success: true, id };
	},
});

registerTool({
	name: "annual_statement_cost_items_delete",
	description: "Löscht eine Kostenposition einer Jahresabrechnung (nur im Entwurfsstatus).",
	inputSchema: buildInputSchema({ id: { type: "string" } }),
	handler: (args) => {
		const { id } = coerceArgs({ id: { type: "string" } }, args);
		const item = getHoaCostItem(id as string);
		if (!item) throw new McpToolError(`Kostenposition mit ID "${id as string}" wurde nicht gefunden.`);
		if (item.annualStatementId) requireAnnualStatementDraft(item.annualStatementId);
		deleteHoaCostItem(id as string);
		return { success: true, id };
	},
});

registerTool({
	name: "hoa_consumption_values_save",
	description:
		"Speichert die Verbrauchswerte (Upsert je Einheit) einer WEG-Kostenposition mit allocationKey = CONSUMPTION. " +
		"Nur möglich, solange die Jahresabrechnung im Entwurfsstatus ist.",
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

		const costItem = getHoaCostItem(costItemId);
		if (!costItem) throw new McpToolError(`Kostenposition mit ID "${costItemId}" wurde nicht gefunden.`);
		if (costItem.annualStatementId) requireAnnualStatementDraft(costItem.annualStatementId);

		const parsed = values.map((entry, index) => {
			const { unitId, value } = coerceArgs(
				{ unitId: { type: "string" }, value: { type: "decimal" } },
				{ unitId: (entry as Record<string, unknown>)?.unitId, value: (entry as Record<string, unknown>)?.value }
			);
			if (!getUnit(unitId as string)) throw new McpToolError(`Einheit "${unitId as string}" (Eintrag ${index + 1}) existiert nicht.`);
			return { unitId: unitId as string, value: value as string };
		});

		saveHoaConsumptionValuesForCostItem(costItemId, parsed);
		return { success: true, costItemId, saved: parsed.length };
	},
});

registerTool({
	name: "annual_statements_finalize",
	description:
		"Berechnet die Einzelabrechnungen je Einheit/Eigentümer (inkl. Hausgeld-Vorauszahlungen) und friert die " +
		"Jahresabrechnung dauerhaft ein (atomare Transaktion). Danach ist sie unveränderlich.",
	inputSchema: buildInputSchema({ id: { type: "string", description: "ID der Jahresabrechnung" } }),
	handler: (args) => {
		const { id } = coerceArgs({ id: { type: "string" } }, args);
		const detail = getAnnualStatementDetail(id as string);
		if (!detail) throw new McpToolError(`Jahresabrechnung mit ID "${id as string}" wurde nicht gefunden.`);
		if (detail.statement.status !== "DRAFT") throw new McpToolError("Diese Jahresabrechnung wurde bereits finalisiert.");
		if (detail.costItems.length === 0) throw new McpToolError("Bitte erfassen Sie mindestens eine Kostenposition, bevor Sie finalisieren.");

		// Berechnung identisch zur Server Action finalizeAnnualStatementAction
		// (src/app/(app)/weg/jahresabrechnung/actions.ts).
		const customWeightsByKey = new Map<string, { unitId: string; weight: number }[]>();
		for (const costItem of detail.costItems) {
			if (costItem.allocationKey !== "CUSTOM" || !costItem.customAllocationKeyId) continue;
			if (customWeightsByKey.has(costItem.customAllocationKeyId)) continue;
			const weights = listCustomAllocationKeyWeightsForStatement(costItem.customAllocationKeyId);
			customWeightsByKey.set(costItem.customAllocationKeyId, weights.map((weight) => ({ unitId: weight.unitId, weight: weight.weight })));
		}

		const housingChargeRows = listPlainHousingChargesForUnits(detail.units.map((unit) => unit.id));

		const result = calculateAnnualStatementResult(
			{
				periodFrom: new Date(detail.statement.periodFrom),
				periodTo: new Date(detail.statement.periodTo),
				units: detail.units.map((unit) => ({
					id: unit.id,
					livingSpace: unit.livingSpace,
					coOwnershipShare: unit.coOwnershipShare,
					ownerships: unit.ownerships.map((ownership) => ({
						id: ownership.id,
						ownerId: ownership.ownerId,
						startDate: ownership.startDate,
						endDate: ownership.endDate,
					})),
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
			housingChargeRows.map((charge) => ({ unitId: charge.unitId, ownerId: charge.ownerId, amount: charge.amount, dueDate: charge.dueDate, status: charge.status }))
		);

		if (result.ownerResults.length === 0) {
			throw new McpToolError("Für den gewählten Zeitraum wurden keine Eigentumsverhältnisse gefunden, die abgerechnet werden könnten.");
		}

		finalizeAnnualStatement(
			id as string,
			result.ownerResults.map((ownerResult) => ({
				unitId: ownerResult.unitId,
				ownerId: ownerResult.ownerId,
				ownedFrom: ownerResult.ownedFrom.toISOString(),
				ownedTo: ownerResult.ownedTo.toISOString(),
				ownedDays: ownerResult.ownedDays,
				totalAllocatedCosts: centsToDecimalString(ownerResult.totalAllocatedCostsCents),
				totalPrepayments: centsToDecimalString(ownerResult.totalPrepaymentsCents),
				balance: centsToDecimalString(ownerResult.balanceCents),
				lines: ownerResult.lines.map((line) => ({ costItemId: line.costItemId, amount: centsToDecimalString(line.amountCents) })),
			}))
		);
		return { success: true, id, unitResults: result.ownerResults.length };
	},
});

// ============================================================
// Hausgeld-Sollstellungen
// ============================================================

const housingChargeFields: Record<string, FieldSpec> = {
	unitId: { type: "string", description: "ID der Einheit" },
	ownerId: { type: "string", description: "ID des Eigentümers" },
	amount: { type: "decimal" },
	dueDate: { type: "date" },
	paidDate: { type: "date", nullable: true },
	purpose: { type: "string", nullable: true },
	status: { type: "enum", values: HOUSING_CHARGE_STATUS },
};

registerCrudTools<HousingChargeInput>({
	entity: "housing_charges",
	entityLabel: "Hausgeld-Sollstellung",
	fields: housingChargeFields,
	listFilters: {
		hoaId: { type: "string", nullable: true, description: "Nur Sollstellungen dieser WEG" },
		unitId: { type: "string", nullable: true, description: "Nur Sollstellungen dieser Einheit" },
	},
	list: (filter) => {
		if (filter.unitId) return listHousingChargesForUnits([filter.unitId as string]);
		if (filter.hoaId) {
			requireHoa(filter.hoaId as string);
			return listHousingChargesForUnits(listUnitsForHoa(filter.hoaId as string).map((unit) => unit.id));
		}
		// Ohne Filter: alle Einheiten aller WEGs.
		const unitIds = listHoasSortedByName().flatMap((hoa) => listUnitsForHoa(hoa.id).map((unit) => unit.id));
		return listHousingChargesForUnits(unitIds);
	},
	beforeCreate: (input) => {
		if (!getUnit(input.unitId)) return "Die angegebene Einheit existiert nicht.";
		if (!getOwner(input.ownerId)) return "Der angegebene Eigentümer existiert nicht.";
		return null;
	},
	beforeUpdate: (_id, input) => {
		if (!getUnit(input.unitId)) return "Die angegebene Einheit existiert nicht.";
		if (!getOwner(input.ownerId)) return "Der angegebene Eigentümer existiert nicht.";
		return null;
	},
	create: (input) => createHousingCharge(input),
	update: (id, input) => updateHousingCharge(id, input),
	delete: (id) => deleteHousingCharge(id),
});

registerTool({
	name: "housing_charges_mark_paid",
	description: "Markiert eine Hausgeld-Sollstellung als bezahlt (Status PAID, Zahldatum = jetzt).",
	inputSchema: buildInputSchema({ id: { type: "string" } }),
	handler: (args) => {
		const { id } = coerceArgs({ id: { type: "string" } }, args);
		markHousingChargePaid(id as string);
		return { success: true, id };
	},
});

// ============================================================
// Erhaltungsrücklage
// ============================================================

registerCrudTools<ReserveFundBookingInput>({
	entity: "reserve_fund_bookings",
	entityLabel: "Rücklagenbuchung",
	fields: {
		hoaId: { type: "string", description: "ID der WEG" },
		bookingDate: { type: "date" },
		type: { type: "enum", values: RESERVE_BOOKING_TYPES, description: "CONTRIBUTION = Zuführung, WITHDRAWAL = Entnahme" },
		amount: { type: "decimal", description: "Immer positiver Betrag - das Vorzeichen ergibt sich aus dem Typ" },
		description: { type: "string" },
		notes: { type: "string", nullable: true },
	},
	listFilters: { hoaId: { type: "string", description: "ID der WEG (Pflicht)" } },
	list: (filter) => {
		requireHoa(filter.hoaId as string);
		return listReserveFundBookings(filter.hoaId as string);
	},
	beforeCreate: (input) => {
		try {
			requireHoa(input.hoaId);
		} catch (error) {
			return (error as Error).message;
		}
		return null;
	},
	create: (input) => createReserveFundBooking(input),
	update: (id, input) => updateReserveFundBooking(id, input),
	delete: (id) => deleteReserveFundBooking(id),
});

registerTool({
	name: "reserve_fund_report",
	description: "Berechnet den (vereinfachten) Vermögensbericht einer WEG nach § 28 Abs. 4 WEG: Rücklagenstand + offene Hausgeldforderungen.",
	inputSchema: buildInputSchema({ hoaId: { type: "string" } }),
	handler: (args) => {
		const { hoaId } = coerceArgs({ hoaId: { type: "string" } }, args);
		requireHoa(hoaId as string);
		return calculateHoaWealthReport(listReserveFundBookings(hoaId as string), listHousingChargeAmountsForHoa(hoaId as string));
	},
});

// ============================================================
// Eigentümerversammlungen, Tagesordnung, Beschluss-Sammlung
// ============================================================

registerCrudTools<OwnerMeetingInput>({
	entity: "owner_meetings",
	entityLabel: "Eigentümerversammlung",
	fields: {
		hoaId: { type: "string", description: "ID der WEG" },
		title: { type: "string" },
		type: { type: "enum", values: MEETING_TYPES },
		status: { type: "enum", values: MEETING_STATUS },
		meetingDate: { type: "date", nullable: true },
		location: { type: "string", nullable: true },
		notes: { type: "string", nullable: true },
	},
	listFilters: { hoaId: { type: "string", nullable: true } },
	list: (filter) => listOwnerMeetings(filter.hoaId ? { hoaId: filter.hoaId as string } : undefined),
	get: (id) => getOwnerMeeting(id),
	beforeCreate: (input) => {
		try {
			requireHoa(input.hoaId);
		} catch (error) {
			return (error as Error).message;
		}
		return null;
	},
	beforeDelete: (id) => {
		if (countResolutionsForMeeting(id) > 0) {
			return "Die Versammlung hat bereits Beschlüsse und kann nicht gelöscht werden (Beschluss-Sammlung muss lückenlos bleiben).";
		}
		return null;
	},
	create: (input) => createOwnerMeeting(input),
	update: (id, input) => updateOwnerMeeting(id, input),
	delete: (id) => deleteOwnerMeeting(id),
});

registerTool({
	name: "owner_meetings_save_minutes",
	description: "Speichert den Protokolltext einer Eigentümerversammlung.",
	inputSchema: buildInputSchema({ id: { type: "string" }, minutesText: { type: "string" } }),
	handler: (args) => {
		const input = coerceArgs({ id: { type: "string" }, minutesText: { type: "string" } }, args);
		if (!getOwnerMeeting(input.id as string)) throw new McpToolError("Die Versammlung wurde nicht gefunden.");
		updateOwnerMeetingMinutesText(input.id as string, input.minutesText as string);
		return { success: true, id: input.id };
	},
});

const agendaItemFields: Record<string, FieldSpec> = {
	meetingId: { type: "string", description: "ID der Versammlung" },
	position: { type: "int", description: "Reihenfolge (1-basiert)" },
	title: { type: "string" },
	description: { type: "string", nullable: true },
};

registerCrudTools<AgendaItemInput>({
	entity: "owner_meeting_agenda_items",
	entityLabel: "Tagesordnungspunkt",
	fields: agendaItemFields,
	listFilters: { meetingId: { type: "string", description: "ID der Versammlung (Pflicht)" } },
	list: (filter) => {
		if (!getOwnerMeeting(filter.meetingId as string)) throw new McpToolError("Die Versammlung wurde nicht gefunden.");
		return listAgendaItemsForMeeting(filter.meetingId as string);
	},
	beforeCreate: (input) => (getOwnerMeeting(input.meetingId) ? null : "Die Versammlung wurde nicht gefunden."),
	create: (input) => createAgendaItem(input),
	update: (id, input) => updateAgendaItem(id, input),
	delete: (id) => deleteAgendaItem(id),
});

const resolutionFields: Record<string, FieldSpec> = {
	hoaId: { type: "string", description: "ID der WEG" },
	meetingId: { type: "string", description: "ID der Versammlung" },
	agendaItemId: { type: "string", nullable: true },
	title: { type: "string" },
	content: { type: "string", description: "Beschlusstext" },
	votingResult: { type: "enum", values: VOTING_RESULTS },
	votesFor: { type: "float", nullable: true },
	votesAgainst: { type: "float", nullable: true },
	votesAbstained: { type: "float", nullable: true },
	resolvedAt: { type: "date", description: "Beschlussdatum" },
	notes: { type: "string", nullable: true },
};

registerCrudTools<OwnerResolutionInput>({
	entity: "owner_resolutions",
	entityLabel: "Beschluss",
	fields: resolutionFields,
	fieldsHint:
		"Die fortlaufende Nummer (sequenceNumber) wird automatisch vergeben (MAX+1); contestedUntil wird aus der " +
		"Anfechtungsfrist (§ 45 WEG) berechnet. Beim Update bleiben Nummer und WEG unverändert.",
	listFilters: { hoaId: { type: "string", nullable: true } },
	list: (filter) => listOwnerResolutions(filter.hoaId ? { hoaId: filter.hoaId as string } : undefined),
	get: (id) => getOwnerResolution(id),
	beforeCreate: (input) => {
		if (!getHoa(input.hoaId)) return "Die angegebene WEG existiert nicht.";
		if (!getOwnerMeeting(input.meetingId)) return "Die Versammlung wurde nicht gefunden.";
		return null;
	},
	beforeDelete: (id) => {
		const resolution = getOwnerResolution(id);
		if (!resolution) return null;
		const maxNumber = Math.max(...listResolutionSequenceNumbersForHoa(resolution.hoaId));
		if (resolution.sequenceNumber !== maxNumber) {
			return "Nur der zuletzt erfasste Beschluss kann gelöscht werden, um Lücken in der fortlaufenden Beschluss-Sammlung zu vermeiden.";
		}
		return null;
	},
	create: (input) =>
		createResolution({
			...input,
			contestedUntil: calculateContestationDeadline(new Date(input.resolvedAt)).toISOString(),
		}),
	update: (id, input) => {
		const { hoaId: _hoaId, ...updateData } = input;
		updateResolution(id, {
			...updateData,
			contestedUntil: calculateContestationDeadline(new Date(input.resolvedAt)).toISOString(),
		});
	},
	delete: (id) => deleteResolution(id),
});
