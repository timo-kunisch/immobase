import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDb, getDb } from "@/data/db";
import {
	createBillingPeriod,
	createCostItem,
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
import { countAllocationsForAccount, createAccount, deleteAccount, getAccount, listAccountsWithStats } from "@/data/accounts";
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
import { createTenant } from "@/data/tenants";
import { createTransaction, generateDueTransactions, listOpenTransactionsForProperty, listTransactions, markTransactionPaid } from "@/data/transactions";
import { createUnit } from "@/data/units";
import { countUsers, createUser, getUserByEmail, listAdminEmails, updateUserApproval } from "@/data/users";

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
		numberOfOccupants: 2,
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
			{ accountId: null, transactionId: transaction.id, amount: "950.00" },
			{ accountId: account.id, transactionId: null, amount: "50.00" },
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

		// Die bezahlte Sollstellung taucht nicht mehr unter den offenen auf.
		expect(listOpenTransactionsForProperty(property.id)).toHaveLength(0);

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
		setBankTransactionAllocations(bankTransaction.id, [{ accountId: null, transactionId: transaction.id, amount: "500.00" }]);

		expect(getBankTransaction(bankTransaction.id)?.status).toBe("PARTIAL");
		const transactionAfter = listTransactions({ leaseId: lease.id })[0];
		expect(transactionAfter.status).toBe("OPEN");
		expect(transactionAfter.paidDate).toBeNull();
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
		setBankTransactionAllocations(bankTransaction.id, [{ accountId: account2.id, transactionId: null, amount: "-120.00" }]);
		expect(countAllocationsForAccount(account2.id)).toBe(1);
		expect(transaction.status).toBe("OPEN");
	});
});
