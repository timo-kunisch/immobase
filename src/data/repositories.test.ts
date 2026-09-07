import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDb, getDb } from "@/data/db";
import { createBillingPeriod, createCostItem, finalizeBillingPeriod, getBillingPeriod } from "@/data/billing";
import { createLease, createRentAdjustment, listLeasesWithDetails } from "@/data/leases";
import { createProperty, deleteProperty, getProperty, getPropertyStats, listProperties, updateProperty } from "@/data/properties";
import { insertSession, deleteAllSessionsForUser, getSessionByToken } from "@/data/sessions";
import { createTenant } from "@/data/tenants";
import { generateDueTransactions, listTransactions, markTransactionPaid } from "@/data/transactions";
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
			category: "WATER_SUPPLY",
			label: "Wasser",
			amount: "100.00",
			allocationKey: "UNITS",
			directUnitId: null,
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
