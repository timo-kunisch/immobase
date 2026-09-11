import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDb } from "@/data/db";
import { createHoa } from "@/data/hoas";
import {
	countHousingChargesForUnits,
	createHousingCharge,
	listHousingChargesForUnits,
	listHousingChargesForUnitsPage,
	listOpenHousingChargeArrearAmounts,
} from "@/data/housing-charges";
import { createLease } from "@/data/leases";
import { countOwnerResolutions, createOwnerMeeting, createResolution, listOwnerResolutions, listOwnerResolutionsPage } from "@/data/meetings";
import { createOwner } from "@/data/owners";
import { createProperty } from "@/data/properties";
import { createTenant } from "@/data/tenants";
import { countTransactions, createTransaction, listOpenTransactionArrearAmounts, listTransactions, listTransactionsPage } from "@/data/transactions";
import { createUnit } from "@/data/units";

/**
 * Tests für die paginierten Repository-Varianten (LIMIT/OFFSET) samt
 * Zählfunktionen und den seitenübergreifenden Rückstands-Aggregaten. Die
 * Listen-Seiten paginieren inzwischen clientseitig (DataTable), die
 * Repository-Funktionen bleiben als getestete Primitive für künftige
 * serverseitige Verbraucher erhalten.
 */

let testDir: string;

beforeEach(() => {
	testDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-pagination-test-"));
	process.env.APP_DATA_DIR = testDir;
});

afterEach(() => {
	closeDb();
	fs.rmSync(testDir, { recursive: true, force: true });
});

function seedLease() {
	const property = createProperty({ name: "Testhaus", street: "Hauptstr. 1", zipCode: "12345", city: "Berlin", country: "Deutschland", notes: null });
	const unit = createUnit({ propertyId: property.id, label: "Whg 1", livingSpace: null, rooms: null, floor: null, coOwnershipShare: null });
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

describe("transactions-Pagination", () => {
	it("zählt, paginiert deterministisch und aggregiert Rückstände seitenübergreifend", () => {
		const { lease } = seedLease();

		// 5 Zahlungen mit identischem Fälligkeitsdatum (Tie-Breaker-Test) + 2 abweichende.
		for (let index = 0; index < 5; index += 1) {
			createTransaction({ leaseId: lease.id, amount: "950.00", dueDate: "2026-02-01", paidDate: null, purpose: `Miete ${index}`, status: "OPEN" });
		}
		createTransaction({ leaseId: lease.id, amount: "100.00", dueDate: "2026-03-01", paidDate: null, purpose: null, status: "OPEN" });
		createTransaction({ leaseId: lease.id, amount: "200.00", dueDate: "2026-01-01", paidDate: "2026-01-02", purpose: null, status: "PAID" });

		expect(countTransactions({ leaseId: lease.id })).toBe(7);
		expect(countTransactions({})).toBe(7);
		expect(countTransactions({ leaseId: "unbekannt" })).toBe(0);

		// Seite 1 (4 Einträge) + Seite 2 (3 Einträge) ohne Überlappung/Lücke.
		const page1 = listTransactionsPage({ leaseId: lease.id }, { limit: 4, offset: 0 });
		const page2 = listTransactionsPage({ leaseId: lease.id }, { limit: 4, offset: 4 });
		expect(page1).toHaveLength(4);
		expect(page2).toHaveLength(3);
		const allIds = [...page1, ...page2].map((row) => row.id);
		expect(new Set(allIds).size).toBe(7);
		// Gleiche Gesamtreihenfolge wie die unpaginierte Liste.
		expect(allIds).toEqual(listTransactions({ leaseId: lease.id }).map((row) => row.id));

		// Status-Filter (alle drei Listen-Funktionen teilen die WHERE-Logik).
		expect(countTransactions({ leaseId: lease.id, status: "OPEN" })).toBe(6);
		expect(countTransactions({ status: "PAID" })).toBe(1);
		expect(countTransactions({ leaseId: lease.id, status: "CANCELLED" })).toBe(0);
		expect(listTransactions({ status: "PAID" })).toHaveLength(1);
		expect(listTransactionsPage({ leaseId: lease.id, status: "OPEN" }, { limit: 50, offset: 0 })).toHaveLength(6);

		// Rückstände: alle offenen, fälligen (due_date <= Stichtag) - die PAID-Zahlung nicht.
		const arrears = listOpenTransactionArrearAmounts(new Date("2026-02-15T00:00:00.000Z"), { leaseId: lease.id });
		expect(arrears).toHaveLength(5);
		expect(arrears.reduce((sum, amount) => sum + Number(amount), 0)).toBe(4750);
		// Ohne Lease-Filter / inkl. der März-Zahlung.
		expect(listOpenTransactionArrearAmounts(new Date("2026-03-15T00:00:00.000Z"))).toHaveLength(6);
	});
});

function seedHoa() {
	const property = createProperty({ name: "WEG-Haus", street: "Str. 1", zipCode: "12345", city: "Berlin", country: "Deutschland", notes: null });
	const unit = createUnit({ propertyId: property.id, label: "WE 1", livingSpace: null, rooms: null, floor: null, coOwnershipShare: 500 });
	const hoa = createHoa({ propertyId: property.id, name: "WEG Test", totalShares: 1000, bankIban: null, bankBic: null, notes: null });
	const owner = createOwner({
		firstName: "Erika",
		lastName: "Muster",
		isCompany: false,
		companyName: null,
		street: "Str. 1",
		zipCode: "12345",
		city: "Berlin",
		country: "Deutschland",
		email: null,
		phone: null,
		notes: null,
	});
	return { property, unit, hoa, owner };
}

describe("housing-charges-Pagination", () => {
	it("zählt, paginiert und aggregiert Rückstände seitenübergreifend", () => {
		const { unit, owner } = seedHoa();

		for (let index = 0; index < 6; index += 1) {
			createHousingCharge({ unitId: unit.id, ownerId: owner.id, amount: "300.00", dueDate: "2026-02-01", paidDate: null, purpose: null, status: "OPEN" });
		}
		createHousingCharge({ unitId: unit.id, ownerId: owner.id, amount: "300.00", dueDate: "2025-12-01", paidDate: "2025-12-05", purpose: null, status: "PAID" });

		expect(countHousingChargesForUnits([unit.id])).toBe(7);
		expect(countHousingChargesForUnits([])).toBe(0);
		expect(listHousingChargesForUnitsPage([], { limit: 5, offset: 0 })).toEqual([]);

		const page1 = listHousingChargesForUnitsPage([unit.id], { limit: 5, offset: 0 });
		const page2 = listHousingChargesForUnitsPage([unit.id], { limit: 5, offset: 5 });
		expect(page1).toHaveLength(5);
		expect(page2).toHaveLength(2);
		const allIds = [...page1, ...page2].map((row) => row.id);
		expect(new Set(allIds).size).toBe(7);
		expect(allIds).toEqual(listHousingChargesForUnits([unit.id]).map((row) => row.id));

		const arrears = listOpenHousingChargeArrearAmounts([unit.id], new Date("2026-02-15T00:00:00.000Z"));
		expect(arrears).toHaveLength(6);
		expect(listOpenHousingChargeArrearAmounts([], new Date("2026-02-15T00:00:00.000Z"))).toEqual([]);
	});
});

describe("owner-resolutions-Pagination", () => {
	it("zählt und paginiert die Beschluss-Sammlung (mit und ohne WEG-Filter)", () => {
		const { hoa } = seedHoa();
		const meeting = createOwnerMeeting({ hoaId: hoa.id, title: "Ordentliche Versammlung 2026", type: "ORDINARY", status: "HELD", meetingDate: "2026-03-01", location: null, notes: null });

		for (let index = 0; index < 7; index += 1) {
			createResolution({
				hoaId: hoa.id,
				meetingId: meeting.id,
				agendaItemId: null,
				title: `Beschluss ${index + 1}`,
				content: "Inhalt",
				votingResult: "ACCEPTED",
				votesFor: null,
				votesAgainst: null,
				votesAbstained: null,
				resolvedAt: "2026-03-01",
				contestedUntil: null,
				notes: null,
			});
		}

		expect(countOwnerResolutions({ hoaId: hoa.id })).toBe(7);
		expect(countOwnerResolutions(undefined)).toBe(7);
		expect(countOwnerResolutions({ hoaId: "unbekannt" })).toBe(0);

		const page1 = listOwnerResolutionsPage({ hoaId: hoa.id }, { limit: 5, offset: 0 });
		const page2 = listOwnerResolutionsPage({ hoaId: hoa.id }, { limit: 5, offset: 5 });
		expect(page1).toHaveLength(5);
		expect(page2).toHaveLength(2);
		// Absteigend nach fortlaufender Nummer, höchste zuerst.
		expect(page1[0].sequenceNumber).toBe(7);
		expect(page1[0].meetingTitle).toBe("Ordentliche Versammlung 2026");
		expect(page2[1].sequenceNumber).toBe(1);
		const allIds = [...page1, ...page2].map((row) => row.id);
		expect(new Set(allIds).size).toBe(7);
		expect(allIds).toEqual(listOwnerResolutions({ hoaId: hoa.id }).map((row) => row.id));
	});
});
