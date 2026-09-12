import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDb, getDb } from "@/data/db";
import {
	createBillingPeriod,
	createCostItem,
	createCostItems,
	deleteBillingPeriodWithArtifacts,
	finalizeBillingPeriod,
	getBillingPeriod,
	getBillingPeriodDetail,
	getCostItem,
	updateTenantStatementPdf,
} from "@/data/billing";
import {
	createCustomAllocationKey,
	deleteCustomAllocationKey,
	listCustomAllocationKeysWithWeights,
	upsertCustomAllocationKeyWeight,
} from "@/data/custom-allocation-keys";
import { countAllocationsForAccount, createAccount, deleteAccount, getAccount, listAccountBookingSumsForPeriod, listAccountsWithStats } from "@/data/accounts";
import {
	createBankTransaction,
	deleteBankTransaction,
	getBankTransaction,
	listBankTransactions,
	setBankTransactionAllocations,
} from "@/data/bank-transactions";
import { createPostalShipment } from "@/data/postal-shipments";
import { createLease, createRentAdjustment, listLeasesWithDetails } from "@/data/leases";
import { createProperty, deleteProperty, getProperty, getPropertyStats, listProperties, updateProperty } from "@/data/properties";
import { insertSession, deleteAllSessionsForUser, getSessionByToken } from "@/data/sessions";
import { createTenant, getTenant, listTenants, updateTenant } from "@/data/tenants";
import { getDashboardCounts, listAllReserveFundBookings, listHousingChargeArrearAmounts, listRentArrearAmounts } from "@/data/dashboard";
import { createTransaction, generateDueTransactions, listOpenTransactionArrearAmounts, listOpenTransactionsForProperty, listTransactions, markTransactionPaid } from "@/data/transactions";
import { createUnit } from "@/data/units";
import { countUsers, createUser, getUserByEmail, listAdminEmails, listUserDisplayNameByEmail, updateUserApproval, updateUserName } from "@/data/users";
import { buildCostItemsFromAccountBookingSums } from "@/lib/billing";
import {
	createAnnualStatement,
	createHoaCostItem,
	deleteAnnualStatementWithArtifacts,
	finalizeAnnualStatement,
	getAnnualStatement,
	updateAnnualStatementUnitResultPdf,
} from "@/data/annual-statements";
import { createHoa } from "@/data/hoas";
import { createHousingCharge, getHousingCharge, listOpenHousingChargesForProperty, markHousingChargePaid } from "@/data/housing-charges";
import { createOwner } from "@/data/owners";
import { createEconomicPlan, finalizeEconomicPlan } from "@/data/economic-plans";
import { createReserveFundBooking } from "@/data/reserve-fund";
import { createDocument } from "@/data/documents";
import { createTicket } from "@/data/tickets";
import { calculateReserveFundBalanceCents } from "@/lib/hoa-reserve";

/**
 * Repository-Layer-Tests gegen eine echte (temporäre) better-sqlite3-
 * Datenbank: CRUD-Roundtrips, Boolean-/Join-Mapping und transaktionale
 * Mehr-Schreib-Operationen (Atomarität).
 */

let testDir: string;

beforeEach(() => {
	testDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-repo-test-"));
	process.env.APP_DATA_DIR = testDir;
});

afterEach(() => {
	closeDb();
	fs.rmSync(testDir, { recursive: true, force: true });
});

function seedPropertyUnitTenantLease() {
	const property = createProperty({
		name: "Testhaus",
		street: "Hauptstr. 1",
		zipCode: "12345",
		city: "Berlin",
		country: "Deutschland",
		notes: null,
	});
	const unit = createUnit({
		propertyId: property.id,
		label: "Whg 1",
		livingSpace: 65.5,
		rooms: 2.5,
		floor: "1. OG",
		coOwnershipShare: null,
	});
	const tenant = createTenant({ firstName: "Max", lastName: "Mustermann", email: null, phone: null, notes: null });
	const lease = createLease({
		unitId: unit.id,
		tenantId: tenant.id,
		startDate: "2026-01-01",
		endDate: null,
		coldRent: "800.00",
		serviceCharges: "150.00",
		deposit: null,
		notes: null,
	});
	return { property, unit, tenant, lease };
}

describe("properties", () => {
	it("CRUD-Roundtrip inkl. Statistik-Aggregation", () => {
		const property = createProperty({
			name: "Musterhaus",
			street: "Str. 1",
			zipCode: "12345",
			city: "Berlin",
			country: "Deutschland",
			notes: "Notiz",
		});
		expect(getProperty(property.id)?.name).toBe("Musterhaus");
		expect(listProperties()).toHaveLength(1);

		updateProperty(property.id, {
			name: "Umbenannt",
			street: "Str. 2",
			zipCode: "54321",
			city: "Hamburg",
			country: "Deutschland",
			notes: null,
		});
		expect(getProperty(property.id)?.name).toBe("Umbenannt");
		expect(getProperty(property.id)?.notes).toBeNull();

		// Statistik: eine Einheit anlegen -> Zähler aktualisiert sich
		const unit = createUnit({
			propertyId: property.id,
			label: "WE 1",
			livingSpace: null,
			rooms: null,
			floor: null,
			coOwnershipShare: null,
		});
		expect(getPropertyStats().get(property.id)?.units).toBe(1);

		// FK-Restrict: Löschen mit vorhandener Einheit schlägt fehl.
		expect(() => deleteProperty(property.id)).toThrow();

		// Erst die Einheit löschen, dann klappt auch die Liegenschaft.
		getDb().prepare("DELETE FROM units WHERE id = ?").run(unit.id);
		deleteProperty(property.id);
		expect(listProperties()).toHaveLength(0);
	});
});

describe("tenants", () => {
	it("CRUD-Roundtrip inkl. optionaler Postanschrift", () => {
		// Anlegen mit vollständiger Postanschrift ...
		const tenant = createTenant({
			firstName: "Erika",
			lastName: "Muster",
			street: "Wohnweg 5",
			zipCode: "54321",
			city: "Hamburg",
			country: "Deutschland",
			email: "erika@example.org",
			phone: null,
			notes: null,
		});
		expect(getTenant(tenant.id)).toMatchObject({
			street: "Wohnweg 5",
			zipCode: "54321",
			city: "Hamburg",
			country: "Deutschland",
		});
		expect(listTenants()[0].city).toBe("Hamburg");

		// ... Bearbeiten leert die Postanschrift (Zustellung wieder an die Einheit) ...
		updateTenant(tenant.id, {
			firstName: "Erika",
			lastName: "Muster",
			street: null,
			zipCode: null,
			city: null,
			country: null,
			email: null,
			phone: null,
			notes: null,
		});
		expect(getTenant(tenant.id)?.street).toBeNull();
		expect(getTenant(tenant.id)?.city).toBeNull();

		// ... und Ausbleiben einzelner Adressfelder wird zu NULL normalisiert.
		const partial = createTenant({
			firstName: "Paul",
			lastName: "Teil",
			zipCode: "12345",
			email: null,
			phone: null,
			notes: null,
		});
		expect(getTenant(partial.id)).toMatchObject({ street: null, zipCode: "12345", city: null, country: null });
	});
});

describe("users + sessions", () => {
	it("mappt is_approved korrekt auf boolean und zählt Nutzer", () => {
		expect(countUsers()).toBe(0);
		const admin = createUser({ email: "admin@example.com", passwordHash: "hash", role: "ADMIN", isApproved: true });
		createUser({ email: "user@example.com", passwordHash: "hash", role: "USER", isApproved: false });

		expect(countUsers()).toBe(2);
		expect(getUserByEmail("admin@example.com")?.isApproved).toBe(true);
		expect(getUserByEmail("user@example.com")?.isApproved).toBe(false);
		expect(listAdminEmails()).toEqual(["admin@example.com"]);

		updateUserApproval(getUserByEmail("user@example.com")!.id, true);
		expect(getUserByEmail("user@example.com")?.isApproved).toBe(true);

		// Sessions
		insertSession({ sessionToken: "tok-1", userId: admin.id, expires: new Date(Date.now() + 10000).toISOString() });
		expect(getSessionByToken("tok-1")?.userId).toBe(admin.id);
		deleteAllSessionsForUser(admin.id);
		expect(getSessionByToken("tok-1")).toBeNull();
	});

	it("speichert Vor-/Nachname und löst E-Mail → Anzeige-Name auf (Fallback E-Mail)", () => {
		const named = createUser({
			email: "max@example.com",
			passwordHash: "hash",
			role: "USER",
			isApproved: true,
			firstName: "Max",
			lastName: "Mustermann",
		});
		const legacy = createUser({ email: "legacy@example.com", passwordHash: "hash", role: "USER", isApproved: true });

		expect(getUserByEmail("max@example.com")?.firstName).toBe("Max");
		expect(getUserByEmail("legacy@example.com")?.lastName).toBeNull();

		const labels = listUserDisplayNameByEmail();
		expect(labels.get("max@example.com")).toBe("Max Mustermann");
		// Altkonto ohne Namen: Fallback auf die E-Mail-Adresse.
		expect(labels.get("legacy@example.com")).toBe("legacy@example.com");

		// Nachträgliches Setzen/Ändern des Namens.
		updateUserName(legacy.id, "Lisa", "Legacy");
		expect(getUserByEmail("legacy@example.com")?.firstName).toBe("Lisa");
		expect(listUserDisplayNameByEmail().get("legacy@example.com")).toBe("Lisa Legacy");

		// Auflösung unbekannter Adressen (gelöschte Konten) liegt beim Aufrufer.
		expect(labels.get(named.email)).toBeDefined();
		expect(labels.get("gone@example.com")).toBeUndefined();
	});
});

describe("leases + rent_adjustments", () => {
	it("liefert Joins (Einheit/Liegenschaft/Mieter) und erzwingt den Unique-Constraint", () => {
		const { lease } = seedPropertyUnitTenantLease();

		const details = listLeasesWithDetails({ tenantId: lease.tenantId });
		expect(details).toHaveLength(1);
		expect(details[0].unit.label).toBe("Whg 1");
		expect(details[0].unit.property.name).toBe("Testhaus");
		expect(details[0].tenant.lastName).toBe("Mustermann");

		createRentAdjustment({ leaseId: lease.id, validFrom: "2026-06-01", coldRent: "850.00", serviceCharges: "160.00", notes: null });
		// Unique (lease_id, valid_from):
		expect(() =>
			createRentAdjustment({ leaseId: lease.id, validFrom: "2026-06-01", coldRent: "900.00", serviceCharges: "170.00", notes: null })
		).toThrow();
	});
});

describe("transactions", () => {
	it("generateDueTransactions ist atomar und dedupliziert; markTransactionPaid setzt das Datum", () => {
		const { lease } = seedPropertyUnitTenantLease();

		// Datumsformat wie in der echten Action: ISO-8601 mit Zeitanteil
		// (src/app/(app)/finanzen/actions.ts verwendet Date.toISOString()).
		const candidate = {
			leaseId: lease.id,
			amount: "950.00",
			dueDate: "2026-02-01T00:00:00.000Z",
			purpose: "Miete Februar 2026",
			monthStart: "2026-02-01T00:00:00.000Z",
			monthEnd: "2026-03-01T00:00:00.000Z",
		};

		expect(generateDueTransactions([candidate])).toEqual({ created: 1, skipped: 0 });
		// Wiederholung -> Duplikat wird übersprungen
		expect(generateDueTransactions([candidate])).toEqual({ created: 0, skipped: 1 });

		const list = listTransactions({ leaseId: lease.id });
		expect(list).toHaveLength(1);
		expect(list[0].status).toBe("OPEN");
		expect(list[0].lease.tenant.lastName).toBe("Mustermann"); // Join-Mapping

		markTransactionPaid(list[0].id);
		const paid = listTransactions({ leaseId: lease.id })[0];
		expect(paid.status).toBe("PAID");
		expect(paid.paidDate).not.toBeNull();
	});
});

describe("billing (transaktionale Finalisierung)", () => {
	it("finalizeBillingPeriod schreibt Statements + Zeilen atomar und setzt FINALIZED", () => {
		const { property, lease } = seedPropertyUnitTenantLease();
		const period = createBillingPeriod({
			propertyId: property.id,
			periodFrom: "2026-01-01",
			periodTo: "2026-12-31",
			notes: null,
		});
		const costItem = createCostItem({
			billingPeriodId: period.id,
			label: "Wasser",
			amount: "100.00",
			allocationKey: "UNITS",
			directUnitId: null,
			customAllocationKeyId: null,
			notes: null,
		});

		finalizeBillingPeriod(period.id, [
			{
				leaseId: lease.id,
				occupiedFrom: "2026-01-01",
				occupiedTo: "2026-12-31",
				occupiedDays: 365,
				totalAllocatedCosts: "100.00",
				totalPrepayments: "150.00",
				balance: "-50.00",
				lines: [{ costItemId: costItem.id, amount: "100.00" }],
			},
		]);

		const updated = getBillingPeriod(period.id);
		expect(updated?.status).toBe("FINALIZED");
		expect(updated?.finalizedAt).not.toBeNull();

		const statementCount = getDb()
			.prepare("SELECT COUNT(*) AS c FROM tenant_statements WHERE billing_period_id = ?")
			.get(period.id) as { c: number };
		expect(statementCount.c).toBe(1);
	});

	it("rollt bei einem Fehler mitten in der Finalisierung komplett zurück", () => {
		const { property, lease } = seedPropertyUnitTenantLease();
		const period = createBillingPeriod({
			propertyId: property.id,
			periodFrom: "2026-01-01",
			periodTo: "2026-12-31",
			notes: null,
		});

		// Zweite Zeile referenziert eine nicht existierende Kostenposition ->
		// FK-Fehler NACH dem ersten erfolgreichen Insert -> kompletter Rollback.
		expect(() =>
			finalizeBillingPeriod(period.id, [
				{
					leaseId: lease.id,
					occupiedFrom: "2026-01-01",
					occupiedTo: "2026-12-31",
					occupiedDays: 365,
					totalAllocatedCosts: "100.00",
					totalPrepayments: "150.00",
					balance: "-50.00",
					lines: [{ costItemId: "existiert-nicht", amount: "100.00" }],
				},
			])
		).toThrow();

		// Kein Teilzustand: weder Statement noch Statuswechsel.
		const statementCount = getDb()
			.prepare("SELECT COUNT(*) AS c FROM tenant_statements WHERE billing_period_id = ?")
			.get(period.id) as { c: number };
		expect(statementCount.c).toBe(0);
		expect(getBillingPeriod(period.id)?.status).toBe("DRAFT");
	});
});

describe("custom_allocation_keys (frei definierbare Umlageschlüssel)", () => {
	it("CRUD + Gewichts-Upsert; Kostenpositions-Verweis wird beim Löschen des Schlüssels auf null gesetzt", () => {
		const { property, unit } = seedPropertyUnitTenantLease();
		const key = createCustomAllocationKey({ propertyId: property.id, label: "Stellplätze", notes: null });
		expect(listCustomAllocationKeysWithWeights(property.id)).toHaveLength(1);

		upsertCustomAllocationKeyWeight(key.id, unit.id, 2);
		upsertCustomAllocationKeyWeight(key.id, unit.id, 3); // Upsert überschreibt
		const keys = listCustomAllocationKeysWithWeights(property.id);
		expect(keys[0].weights).toHaveLength(1);
		expect(keys[0].weights[0].weight).toBe(3);

		const period = createBillingPeriod({ propertyId: property.id, periodFrom: "2026-01-01", periodTo: "2026-12-31", notes: null });
		const costItem = createCostItem({
			billingPeriodId: period.id,
			label: "Garagenbeleuchtung",
			amount: "50.00",
			allocationKey: "CUSTOM",
			directUnitId: null,
			customAllocationKeyId: key.id,
			notes: null,
		});

		// ON DELETE set null: Die Position bleibt erhalten, der Verweis fällt weg.
		deleteCustomAllocationKey(key.id);
		expect(getCostItem(costItem.id)?.customAllocationKeyId).toBeNull();
		expect(listCustomAllocationKeysWithWeights(property.id)).toHaveLength(0);
	});

	it("getBillingPeriodDetail liefert bezahlte Sollstellungen je Mietvertrag mit", () => {
		const { property, lease } = seedPropertyUnitTenantLease();
		const period = createBillingPeriod({ propertyId: property.id, periodFrom: "2026-01-01", periodTo: "2026-12-31", notes: null });

		createTransaction({ leaseId: lease.id, amount: "950.00", dueDate: "2026-02-01T00:00:00.000Z", paidDate: null, purpose: "Miete Februar", status: "OPEN" });
		const paid = createTransaction({ leaseId: lease.id, amount: "950.00", dueDate: "2026-03-01T00:00:00.000Z", paidDate: null, purpose: "Miete März", status: "PAID" });
		expect(paid.status).toBe("PAID");

		const detail = getBillingPeriodDetail(period.id);
		const billingLease = detail?.units.flatMap((unit) => unit.leases).find((entry) => entry.id === lease.id);
		expect(billingLease?.paidTransactions.map((payment) => payment.dueDate)).toEqual(["2026-03-01T00:00:00.000Z"]);
	});
});

describe("buchhaltung (Konten, Banktransaktionen, Zuordnung)", () => {
	it("markiert eine vollständig zugeordnete Sollstellung als bezahlt; Löschen der Banktransaktion stellt den offenen Status wieder her", () => {
		const { property, lease } = seedPropertyUnitTenantLease();
		const account = createAccount({ propertyId: property.id, label: "Gebäudeversicherung", notes: null });
		const transaction = createTransaction({
			leaseId: lease.id,
			amount: "950.00",
			dueDate: "2026-02-01T00:00:00.000Z",
			paidDate: null,
			purpose: "Miete Februar 2026",
			status: "OPEN",
		});

		const bankTransaction = createBankTransaction({
			propertyId: property.id,
			bookingDate: "2026-02-05T00:00:00.000Z",
			amount: "1000.00",
			description: "Überweisung Mustermann",
			partner: "Max Mustermann",
			notes: null,
		});

		// Split: 950 € gegen die Sollstellung (Miete), 50 € auf das Konto.
		setBankTransactionAllocations(bankTransaction.id, [
			{ accountId: null, transactionId: transaction.id, housingChargeId: null, amount: "950.00" },
			{ accountId: account.id, transactionId: null, housingChargeId: null, amount: "50.00" },
		]);

		const paid = listTransactions({ leaseId: lease.id })[0];
		expect(paid.status).toBe("PAID");
		// paid_date = frühestes Buchungsdatum der zugeordneten Banktransaktion.
		expect(paid.paidDate).toBe("2026-02-05T00:00:00.000Z");

		const view = getBankTransaction(bankTransaction.id);
		expect(view?.status).toBe("RECONCILED");
		expect(view?.allocatedAmount).toBe("1000.00");
		expect(view?.allocations).toHaveLength(2);
		expect(view?.allocations.find((allocation) => allocation.accountId)?.account?.label).toBe("Gebäudeversicherung");
		expect(view?.allocations.find((allocation) => allocation.transactionId)?.transactionLabel).toContain("Miete Februar 2026");

		// Konten-Statistik + abgeleiteter Status-Filter.
		const accounts = listAccountsWithStats(property.id);
		expect(accounts[0].allocatedAmount).toBe("50.00");
		expect(accounts[0].bookingCount).toBe(1);
		expect(countAllocationsForAccount(account.id)).toBe(1);
		expect(listBankTransactions({ propertyId: property.id, status: "RECONCILED" })).toHaveLength(1);
		expect(listBankTransactions({ propertyId: property.id, status: "OPEN" })).toHaveLength(0);

		// Die bezahlte Sollstellung taucht nicht mehr unter den offenen auf
		// und erzeugt auch keinen Rückstand mehr.
		expect(listOpenTransactionsForProperty(property.id)).toHaveLength(0);
		expect(listOpenTransactionArrearAmounts(new Date("2026-02-15T00:00:00.000Z"))).toEqual([]);

		// Löschen der Banktransaktion entfernt die Zuordnung: Die Sollstellung
		// ist wieder offen (Buchungsevidenz weg).
		deleteBankTransaction(bankTransaction.id);
		const reopened = listTransactions({ leaseId: lease.id })[0];
		expect(reopened.status).toBe("OPEN");
		expect(reopened.paidDate).toBeNull();
		expect(listBankTransactions({ propertyId: property.id })).toHaveLength(0);
	});

	it("Teilzuordnung lässt die Sollstellung offen (Status PARTIAL der Banktransaktion)", () => {
		const { property, lease } = seedPropertyUnitTenantLease();
		const transaction = createTransaction({
			leaseId: lease.id,
			amount: "950.00",
			dueDate: "2026-02-01T00:00:00.000Z",
			paidDate: null,
			purpose: "Miete Februar 2026",
			status: "OPEN",
		});
		// 1000 € Eingang, nur 500 € zugeordnet -> PARTIAL; die Sollstellung
		// (950 €) ist damit noch nicht vollständig ausgeglichen.
		const bankTransaction = createBankTransaction({
			propertyId: property.id,
			bookingDate: "2026-02-05T00:00:00.000Z",
			amount: "1000.00",
			description: "Überweisung Mustermann",
			partner: null,
			notes: null,
		});
		setBankTransactionAllocations(bankTransaction.id, [{ accountId: null, transactionId: transaction.id, housingChargeId: null, amount: "500.00" }]);

		expect(getBankTransaction(bankTransaction.id)?.status).toBe("PARTIAL");
		const transactionAfter = listTransactions({ leaseId: lease.id })[0];
		expect(transactionAfter.status).toBe("OPEN");
		expect(transactionAfter.paidDate).toBeNull();

		// Rückstände (Finanzen + Dashboard) zeigen nur den verbleibenden
		// offenen Rest: 950 € Sollbetrag abzüglich 500 € zugeordneter
		// Teilzahlung aus der Buchhaltung.
		const now = new Date("2026-02-15T00:00:00.000Z");
		expect(listOpenTransactionArrearAmounts(now)).toEqual(["450.00"]);
		expect(listRentArrearAmounts(now)).toEqual(["450.00"]);
	});

	it("bündelt Kontobewegungen je Konto im Abrechnungszeitraum als Kostenpositionen (Import in die Abrechnung)", () => {
		const { property, lease } = seedPropertyUnitTenantLease();
		const insurance = createAccount({ propertyId: property.id, label: "Gebäudeversicherung", notes: null });
		const water = createAccount({ propertyId: property.id, label: "Wasserversorgung", notes: null });
		const heating = createAccount({ propertyId: property.id, label: "Heizung", notes: null });

		const booking = (bookingDate: string, amount: string, description: string) =>
			createBankTransaction({ propertyId: property.id, bookingDate, amount, description, partner: null, notes: null });

		// Buchungen im Abrechnungszeitraum: Aufwand, Erstattung (wird
		// verrechnet), eine gegen die Sollstellung (bleibt beim Import
		// unberücksichtigt - sie zählt als geleistete Vorauszahlung) ...
		const insurancePayment = booking("2026-03-05T00:00:00.000Z", "-480.00", "Versicherung Jahresprämie");
		const insuranceRefund = booking("2026-09-05T00:00:00.000Z", "80.00", "Erstattung Versicherung");
		const waterPayment = booking("2026-06-05T00:00:00.000Z", "-250.50", "Wasser Jahresabrechnung");
		const heatingPayment = booking("2026-04-05T00:00:00.000Z", "-100.00", "Heizung Vorauszahlung");
		const heatingRefund = booking("2026-11-05T00:00:00.000Z", "100.00", "Heizung Abrechnungsguthaben");
		const rent = createTransaction({
			leaseId: lease.id,
			amount: "950.00",
			dueDate: "2026-03-01T00:00:00.000Z",
			paidDate: null,
			purpose: "Miete März",
			status: "OPEN",
		});
		const rentPayment = booking("2026-03-05T00:00:00.000Z", "950.00", "Miete März");
		// ... und eine Buchung AUSSERHALB des Abrechnungszeitraums.
		const nextYearPayment = booking("2027-02-05T00:00:00.000Z", "-480.00", "Versicherung Folgejahr");

		setBankTransactionAllocations(insurancePayment.id, [{ accountId: insurance.id, transactionId: null, housingChargeId: null, amount: "-480.00" }]);
		setBankTransactionAllocations(insuranceRefund.id, [{ accountId: insurance.id, transactionId: null, housingChargeId: null, amount: "80.00" }]);
		setBankTransactionAllocations(waterPayment.id, [{ accountId: water.id, transactionId: null, housingChargeId: null, amount: "-250.50" }]);
		setBankTransactionAllocations(heatingPayment.id, [{ accountId: heating.id, transactionId: null, housingChargeId: null, amount: "-100.00" }]);
		setBankTransactionAllocations(heatingRefund.id, [{ accountId: heating.id, transactionId: null, housingChargeId: null, amount: "100.00" }]);
		setBankTransactionAllocations(rentPayment.id, [{ accountId: null, transactionId: rent.id, housingChargeId: null, amount: "950.00" }]);
		setBankTransactionAllocations(nextYearPayment.id, [{ accountId: insurance.id, transactionId: null, housingChargeId: null, amount: "-480.00" }]);

		const period = createBillingPeriod({
			propertyId: property.id,
			periodFrom: "2026-01-01T00:00:00.000Z",
			periodTo: "2026-12-31T23:59:59.999Z",
			notes: null,
		});

		// Nettosummen je Konto, alphabetisch sortiert: Erstattungen
		// verrechnet, Sollstellungs-Buchung ausgenommen, Buchung außerhalb
		// des Zeitraums ignoriert.
		const sums = listAccountBookingSumsForPeriod(property.id, period.periodFrom, period.periodTo);
		expect(sums).toEqual([
			{ id: insurance.id, label: "Gebäudeversicherung", totalCents: -40_000, bookingCount: 2 },
			{ id: heating.id, label: "Heizung", totalCents: 0, bookingCount: 2 },
			{ id: water.id, label: "Wasserversorgung", totalCents: -25_050, bookingCount: 1 },
		]);

		// Import: Konto mit Saldo 0 (Heizung) erzeugt keine Position; die
		// Sollstellung bleibt über die bezahlt-Logik Vorauszahlung (nicht
		// Kostenposition).
		const items = buildCostItemsFromAccountBookingSums(sums, "LIVING_SPACE");
		expect(items.map((item) => item.label)).toEqual(["Gebäudeversicherung", "Wasserversorgung"]);

		const created = createCostItems(
			items.map((item) => ({
				billingPeriodId: period.id,
				label: item.label,
				amount: item.amount,
				allocationKey: item.allocationKey,
				directUnitId: null,
				customAllocationKeyId: null,
				notes: item.notes,
			}))
		);
		expect(created).toHaveLength(2);

		const detail = getBillingPeriodDetail(period.id);
		expect(detail?.costItems.map((costItem) => costItem.label)).toEqual(["Gebäudeversicherung", "Wasserversorgung"]);
		const importedInsurance = detail?.costItems.find((costItem) => costItem.label === "Gebäudeversicherung");
		expect(importedInsurance?.amount).toBe("400.00");
		expect(importedInsurance?.allocationKey).toBe("LIVING_SPACE");
		expect(importedInsurance?.notes).toBe("Übernommen aus der Buchhaltung (2 Buchungen im Abrechnungszeitraum).");
		expect(listTransactions({ leaseId: lease.id })[0].status).toBe("PAID");
	});

	it("deleteBillingPeriodWithArtifacts entfernt auch finalisierte Perioden samt Statements und Protokollen", async () => {
		const { property, lease } = seedPropertyUnitTenantLease();
		const period = createBillingPeriod({ propertyId: property.id, periodFrom: "2026-01-01", periodTo: "2026-12-31", notes: null });
		const costItem = createCostItem({
			billingPeriodId: period.id,
			label: "Wasser",
			amount: "100.00",
			allocationKey: "UNITS",
			directUnitId: null,
			customAllocationKeyId: null,
			notes: null,
		});
		finalizeBillingPeriod(period.id, [
			{
				leaseId: lease.id,
				occupiedFrom: "2026-01-01",
				occupiedTo: "2026-12-31",
				occupiedDays: 365,
				totalAllocatedCosts: "100.00",
				totalPrepayments: "150.00",
				balance: "-50.00",
				lines: [{ costItemId: costItem.id, amount: "100.00" }],
			},
		]);

		const statement = getDb()
			.prepare("SELECT id FROM tenant_statements WHERE billing_period_id = ?")
			.get(period.id) as { id: string };
		updateTenantStatementPdf(statement.id, { pdfPath: "billing-statements/fake.pdf", pdfFileSize: 10, pdfGeneratedAt: "2026-03-01T00:00:00.000Z" });
		createPostalShipment({
			sourceType: "TENANT_STATEMENT",
			sourceId: statement.id,
			externalJobId: "job-1",
			externalStatus: "done",
			mode: "test",
			status: "REGISTERED",
			errorMessage: null,
			requestedByUserId: null,
		});

		// Finalisierte Perioden sind löschbar (nicht mehr bearbeitbar, Löschung
		// bleibt möglich) - inkl. Abrechnungs-PDFs + Postversand-Protokolle.
		await deleteBillingPeriodWithArtifacts(period.id);
		expect(getBillingPeriod(period.id)).toBeNull();

		const statementCount = getDb().prepare("SELECT COUNT(*) AS c FROM tenant_statements WHERE billing_period_id = ?").get(period.id) as { c: number };
		const shipmentCount = getDb().prepare("SELECT COUNT(*) AS c FROM postal_shipments WHERE source_id = ?").get(statement.id) as { c: number };
		expect(statementCount.c).toBe(0);
		expect(shipmentCount.c).toBe(0);
	});

	it("Konto-Löschung ist über den Guard prüfbar (Buchungen vorhanden)", () => {
		const { property, lease } = seedPropertyUnitTenantLease();
		const account = createAccount({ propertyId: property.id, label: "Gebäudeversicherung", notes: null });
		const transaction = createTransaction({
			leaseId: lease.id,
			amount: "950.00",
			dueDate: "2026-02-01T00:00:00.000Z",
			paidDate: null,
			purpose: "Miete Februar 2026",
			status: "OPEN",
		});

		expect(countAllocationsForAccount(account.id)).toBe(0);
		deleteAccount(account.id);
		expect(getAccount(account.id)).toBeNull();

		// Konto mit Buchung: Guard meldet Buchungen, DB-Kaskade würde sie mitnehmen.
		const account2 = createAccount({ propertyId: property.id, label: "Reparaturen", notes: null });
		const bankTransaction = createBankTransaction({
			propertyId: property.id,
			bookingDate: "2026-02-10T00:00:00.000Z",
			amount: "-120.00",
			description: "Abbuchung Reparatur",
			partner: null,
			notes: null,
		});
		setBankTransactionAllocations(bankTransaction.id, [{ accountId: account2.id, transactionId: null, housingChargeId: null, amount: "-120.00" }]);
		expect(countAllocationsForAccount(account2.id)).toBe(1);
		expect(transaction.status).toBe("OPEN");
	});
});

describe("WEG-Buchhaltung und Jahresabrechnung", () => {
	function seedHoaWithHousingCharge() {
		const { property, unit, tenant, lease } = seedPropertyUnitTenantLease();
		const hoa = createHoa({ propertyId: property.id, name: "WEG Testhaus", totalShares: 1000, bankIban: null, bankBic: null, notes: null });
		const owner = createOwner({
			firstName: "Erika",
			lastName: "Eigentümer",
			isCompany: false,
			companyName: null,
			street: "Weg 2",
			zipCode: "12345",
			city: "Berlin",
			country: "Deutschland",
			email: null,
			phone: null,
			notes: null,
		});
		const housingCharge = createHousingCharge({
			unitId: unit.id,
			ownerId: owner.id,
			amount: "300.00",
			dueDate: "2026-02-01T00:00:00.000Z",
			paidDate: null,
			purpose: "Hausgeld Februar 2026",
			status: "OPEN",
		});
		return { property, unit, tenant, lease, hoa, owner, housingCharge };
	}

	it("bucht Zahlungseingänge von Eigentümern gegen Hausgeld-Sollstellungen: vollständige Zuordnung = bezahlt", () => {
		const { property, lease, housingCharge } = seedHoaWithHousingCharge();
		// Miet-Sollstellung derselben Liegenschaft (Buchungskreis Miete).
		const rent = createTransaction({
			leaseId: lease.id,
			amount: "650.00",
			dueDate: "2026-02-01T00:00:00.000Z",
			paidDate: null,
			purpose: "Miete Februar 2026",
			status: "OPEN",
		});

		const bankTransaction = createBankTransaction({
			propertyId: property.id,
			bookingDate: "2026-02-05T00:00:00.000Z",
			amount: "950.00",
			description: "Sammelüberweisung",
			partner: null,
			notes: null,
		});

		// Split: 300 € gegen das Hausgeld (WEG-Kreis), 650 € gegen die Miete
		// (Miete-Kreis) - BEIDE Buchungskreise in einer Banktransaktion.
		setBankTransactionAllocations(bankTransaction.id, [
			{ accountId: null, transactionId: null, housingChargeId: housingCharge.id, amount: "300.00" },
			{ accountId: null, transactionId: rent.id, housingChargeId: null, amount: "650.00" },
		]);

		// Die vollständig zugeordnete HAUSGELD-Sollstellung gilt als bezahlt
		// (paid_date = Buchungsdatum) - Grundlage der Jahresabrechnung,
		// die ausschließlich tatsächlich geleistete Zahlungen ansetzt.
		const paidHousingCharge = getHousingCharge(housingCharge.id)!;
		expect(paidHousingCharge.status).toBe("PAID");
		expect(paidHousingCharge.paidDate).toBe("2026-02-05T00:00:00.000Z");

		// Anzeige-Referenz der Buchungszeile (Eigentümer + Verwendungszweck).
		const view = getBankTransaction(bankTransaction.id);
		expect(view?.allocations.find((allocation) => allocation.housingChargeId)?.housingChargeLabel).toContain("Hausgeld Februar 2026");

		// Bezahlte Hausgelder verschwinden aus der Auswahl offener Sollstellungen.
		expect(listOpenHousingChargesForProperty(property.id)).toHaveLength(0);

		// ... und die Miete ist ebenfalls bezahlt - die Kreise stören sich nicht.
		expect(listTransactions({ leaseId: lease.id })[0].status).toBe("PAID");

		// Löschen der Banktransaktion stellt BEIDE Sollstellungen wieder offen.
		deleteBankTransaction(bankTransaction.id);
		expect(getHousingCharge(housingCharge.id)?.status).toBe("OPEN");
		expect(getHousingCharge(housingCharge.id)?.paidDate).toBeNull();
		expect(listTransactions({ leaseId: lease.id })[0].status).toBe("OPEN");
	});

	it("Teilzuordnung lässt die Hausgeld-Sollstellung offen - Miete-Buchungen berühren den Hausgeld-Status nicht", () => {
		const { property, housingCharge } = seedHoaWithHousingCharge();

		const bankTransaction = createBankTransaction({
			propertyId: property.id,
			bookingDate: "2026-02-05T00:00:00.000Z",
			amount: "100.00",
			description: "Teilzahlung Hausgeld",
			partner: null,
			notes: null,
		});
		setBankTransactionAllocations(bankTransaction.id, [{ accountId: null, transactionId: null, housingChargeId: housingCharge.id, amount: "100.00" }]);

		// 100 € von 300 € Soll zugeordnet: Die Banktransaktion ist zwar vollständig
		// zugeordnet (RECONCILED), aber die Hausgeld-Sollstellung nur teilweise
		// gedeckt - der Status bleibt daher OPEN (Teilzahlungen werden im
		// Zahlungsmodell nicht als bezahlt abgebildet).
		expect(getBankTransaction(bankTransaction.id)?.status).toBe("RECONCILED");
		expect(getHousingCharge(housingCharge.id)?.status).toBe("OPEN");
		expect(listOpenHousingChargesForProperty(property.id)).toHaveLength(1);

		// Manuelle Schnellaktion bleibt parallel nutzbar.
		markHousingChargePaid(housingCharge.id);
		expect(getHousingCharge(housingCharge.id)?.status).toBe("PAID");
	});

	it("listOpenHousingChargesForProperty liefert nur offene Sollstellungen der Liegenschaft (älteste zuerst)", () => {
		const { property, housingCharge } = seedHoaWithHousingCharge();
		createHousingCharge({
			unitId: housingCharge.unitId,
			ownerId: housingCharge.ownerId,
			amount: "250.00",
			dueDate: "2026-01-01T00:00:00.000Z",
			paidDate: null,
			purpose: "Hausgeld Januar 2026",
			status: "OPEN",
		});

		// Andere Liegenschaft: fließt nicht in die Auswahl ein.
		const otherProperty = createProperty({ name: "Anderes Haus", street: "S", zipCode: "1", city: "C", country: "D", notes: null });
		const otherUnit = createUnit({ propertyId: otherProperty.id, label: "Whg X", livingSpace: 40, rooms: 1, floor: null, coOwnershipShare: null });
		const otherOwner = createOwner({
			firstName: "X",
			lastName: "Y",
			isCompany: false,
			companyName: null,
			street: "S",
			zipCode: "1",
			city: "C",
			country: "D",
			email: null,
			phone: null,
			notes: null,
		});
		createHousingCharge({
			unitId: otherUnit.id,
			ownerId: otherOwner.id,
			amount: "10.00",
			dueDate: "2026-01-01T00:00:00.000Z",
			paidDate: null,
			purpose: "Fremd",
			status: "OPEN",
		});

		const open = listOpenHousingChargesForProperty(property.id);
		expect(open).toHaveLength(2);
		expect(open.map((charge) => charge.purpose)).toEqual(["Hausgeld Januar 2026", "Hausgeld Februar 2026"]);
	});

	it("deleteAnnualStatementWithArtifacts entfernt auch finalisierte Abrechnungen samt PDF-Protokollen", async () => {
		const { unit, owner, hoa } = seedHoaWithHousingCharge();
		const statement = createAnnualStatement({ hoaId: hoa.id, periodFrom: "2026-01-01", periodTo: "2026-12-31", notes: null });
		const costItem = createHoaCostItem({
			context: "STATEMENT",
			economicPlanId: null,
			annualStatementId: statement.id,
			label: "Wasser",
			amount: "100.00",
			allocationKey: "MEA",
			directUnitId: null,
			customAllocationKeyId: null,
			isApportionable: true,
			notes: null,
		});

		finalizeAnnualStatement(statement.id, [
			{
				unitId: unit.id,
				ownerId: owner.id,
				ownedFrom: "2026-01-01",
				ownedTo: "2026-12-31",
				ownedDays: 365,
				totalAllocatedCosts: "100.00",
				totalPrepayments: "300.00",
				balance: "-200.00",
				lines: [{ costItemId: costItem.id, amount: "100.00" }],
			},
		]);

		const unitResultId = getDb().prepare("SELECT id FROM annual_statement_unit_results WHERE annual_statement_id = ?").get(statement.id) as {
			id: string;
		};
		updateAnnualStatementUnitResultPdf(unitResultId.id, { pdfPath: "hoa-annual-statements/fake.pdf", pdfFileSize: 10, pdfGeneratedAt: "2026-03-01T00:00:00.000Z" });
		createPostalShipment({
			sourceType: "HOA_ANNUAL_STATEMENT",
			sourceId: unitResultId.id,
			externalJobId: "job-1",
			externalStatus: "done",
			mode: "test",
			status: "REGISTERED",
			errorMessage: null,
			requestedByUserId: null,
		});

		// Finalisierte Abrechnungen sind löschbar - inkl. Einzelabrechnungs-
		// PDFs + Postversand-Protokolle (Muster: deleteBillingPeriodWithArtifacts).
		await deleteAnnualStatementWithArtifacts(statement.id);
		expect(getAnnualStatement(statement.id)).toBeNull();

		const resultCount = getDb().prepare("SELECT COUNT(*) AS c FROM annual_statement_unit_results WHERE annual_statement_id = ?").get(statement.id) as {
			c: number;
		};
		const shipmentCount = getDb().prepare("SELECT COUNT(*) AS c FROM postal_shipments WHERE source_id = ?").get(unitResultId.id) as { c: number };
		expect(resultCount.c).toBe(0);
		expect(shipmentCount.c).toBe(0);
	});
});

describe("Dashboard-Aggregationen", () => {
	it("zählt Kennzahlen aller Fachbereiche und summiert Hausgeld-Rückstände/Rücklagensaldo", () => {
		const { property, unit, tenant } = seedPropertyUnitTenantLease();
		const hoa = createHoa({ propertyId: property.id, name: "WEG Testhaus", totalShares: 1000, bankIban: null, bankBic: null, notes: null });
		const owner = createOwner({
			firstName: "Erika",
			lastName: "Eigentümer",
			isCompany: false,
			companyName: null,
			street: "Weg 2",
			zipCode: "12345",
			city: "Berlin",
			country: "Deutschland",
			email: null,
			phone: null,
			notes: null,
		});

		// Hausgeld: eine fällige offene + eine bezahlte + eine erst künftig
		// fällige Sollstellung (nur die erste ist Rückstand).
		createHousingCharge({
			unitId: unit.id,
			ownerId: owner.id,
			amount: "300.00",
			dueDate: "2026-02-01T00:00:00.000Z",
			paidDate: null,
			purpose: "Hausgeld Februar 2026",
			status: "OPEN",
		});
		createHousingCharge({
			unitId: unit.id,
			ownerId: owner.id,
			amount: "250.00",
			dueDate: "2026-03-01T00:00:00.000Z",
			paidDate: "2026-03-02T00:00:00.000Z",
			purpose: "Hausgeld März 2026",
			status: "PAID",
		});
		createHousingCharge({
			unitId: unit.id,
			ownerId: owner.id,
			amount: "250.00",
			dueDate: "2027-01-01T00:00:00.000Z",
			paidDate: null,
			purpose: "Hausgeld Januar 2027",
			status: "OPEN",
		});

		// Erhaltungsrücklage: 500 € Zuführung, 120 € Entnahme -> 380 € Saldo.
		createReserveFundBooking({ hoaId: hoa.id, bookingDate: "2026-01-15", type: "CONTRIBUTION", amount: "500.00", description: "Jahreszuführung", notes: null });
		createReserveFundBooking({ hoaId: hoa.id, bookingDate: "2026-03-20", type: "WITHDRAWAL", amount: "120.00", description: "Dachreparatur", notes: null });

		// Entwürfe: Abrechnungsperiode (Miete), Wirtschaftsplan + Jahresabrechnung (WEG).
		createBillingPeriod({ propertyId: property.id, periodFrom: "2026-01-01", periodTo: "2026-12-31", notes: null });
		const economicPlan = createEconomicPlan({ hoaId: hoa.id, fiscalYearFrom: "2026-01-01", fiscalYearTo: "2026-12-31", notes: null });
		createAnnualStatement({ hoaId: hoa.id, periodFrom: "2026-01-01", periodTo: "2026-12-31", notes: null });

		// DMS-Dokument + offenes Ticket.
		createDocument({
			propertyId: property.id,
			unitId: unit.id,
			tenantId: tenant.id,
			type: "CONTRACT",
			fileName: "mietvertrag.pdf",
			filePath: "documents/test.pdf",
			mimeType: "application/pdf",
			fileSize: 42,
		});
		createTicket({ propertyId: property.id, unitId: unit.id, title: "Fenster klemmt", description: null, status: "OPEN", resolvedAt: null });

		const now = new Date("2026-06-15T00:00:00.000Z");
		expect(getDashboardCounts(now)).toEqual({
			propertiesCount: 1,
			unitsCount: 1,
			tenantsCount: 1,
			openTicketsCount: 1,
			occupiedUnitsCount: 1,
			activeLeasesCount: 1,
			draftBillingPeriodsCount: 1,
			hoasCount: 1,
			ownersCount: 1,
			draftEconomicPlansCount: 1,
			draftAnnualStatementsCount: 1,
			documentsCount: 1,
		});

		// Nur die fällige offene Hausgeld-Sollstellung ist Rückstand (volle
		// 300 € - Teilzuordnungen aus der Buchhaltung werden, wie auf
		// /weg/hausgeld, nicht abgezogen).
		expect(listHousingChargeArrearAmounts(now)).toEqual(["300.00"]);

		// Rücklagensaldo über alle WEGs (gleiche Berechnung wie /weg/ruecklage).
		expect(calculateReserveFundBalanceCents(listAllReserveFundBookings(), now)).toBe(38000);

		// Finalisierte Entwürfe verschwinden aus den Zählern.
		finalizeEconomicPlan(economicPlan.id, [{ unitId: unit.id, annualAmount: "600.00", monthlyAmount: "50.00" }]);
		expect(getDashboardCounts(now).draftEconomicPlansCount).toBe(0);

		// Bezahlte Hausgelder und Mietrückstände bleiben getrennte Kreise:
		// Der laufende Mietvertrag hat keine Sollstellung -> keine Mietrückstände.
		expect(listRentArrearAmounts(now)).toEqual([]);
	});
});
