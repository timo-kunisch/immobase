import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDb, getDb } from "@/data/db";
import { createBillingPeriod } from "@/data/billing";
import { createDocument } from "@/data/documents";
import { createHoa } from "@/data/hoas";
import { createKnowledgeBaseArticle } from "@/data/knowledge-base";
import { createOwner } from "@/data/owners";
import { createProperty } from "@/data/properties";
import { searchDatabase } from "@/data/search";
import { createTenant } from "@/data/tenants";
import { createTicket } from "@/data/tickets";
import { createUnit } from "@/data/units";
import { createUser } from "@/data/users";
import { createLease } from "@/data/leases";

/**
 * Tests der globalen Suche (Repository src/data/search.ts) gegen eine echte
 * (temporäre) better-sqlite3-Datenbank: Treffer über mehrere Entitätsarten,
 * Unicode-Faltung (Umlaute), Verweis-Ziele (href), Admin-Gating der
 * Benutzerkonten und das Limit je Entitätsart.
 */

let testDir: string;

beforeEach(() => {
	testDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-search-test-"));
	process.env.APP_DATA_DIR = testDir;
});

afterEach(() => {
	closeDb();
	fs.rmSync(testDir, { recursive: true, force: true });
});

/** Legt den üblichen Stammdaten-Satz an und gibt die Objekte zurück. */
function seedBaseData() {
	const property = createProperty({
		name: "Lindenhöfe",
		street: "Musterweg 3",
		zipCode: "80331",
		city: "München",
		country: "Deutschland",
		notes: null,
	});
	const unit = createUnit({
		propertyId: property.id,
		label: "Whg 1",
		livingSpace: 60,
		rooms: 2,
		floor: "1. OG",
		coOwnershipShare: null,
	});
	const tenant = createTenant({
		firstName: "Erika",
		lastName: "Müller",
		email: "erika.mueller@example.org",
		phone: null,
		notes: null,
	});
	const lease = createLease({
		unitId: unit.id,
		tenantId: tenant.id,
		startDate: "2026-01-01",
		endDate: null,
		coldRent: "700.00",
		serviceCharges: "120.00",
		numberOfOccupants: 1,
		deposit: null,
		notes: null,
	});
	return { property, unit, tenant, lease };
}

describe("searchDatabase", () => {
	it("findet Mieter, Liegenschaft, Einheit und Vertrag - inkl. Umlaut-Faltung", () => {
		const { property, unit, tenant, lease } = seedBaseData();

		// „münchen“ (kleingeschrieben) muss „München“ finden - SQLites LIKE
		// könnte das nicht (ASCII-only-Faltung), der JS-Pfad schon.
		const cityHits = searchDatabase("münchen");
		expect(cityHits.some((row) => row.type === "property" && row.id === property.id)).toBe(true);

		// Gleiches für den Mieter-Namen „Müller“.
		const tenantHits = searchDatabase("müller");
		const tenantRow = tenantHits.find((row) => row.type === "tenant");
		expect(tenantRow?.id).toBe(tenant.id);
		expect(tenantRow?.title).toBe("Erika Müller");
		expect(tenantRow?.subtitle).toBe("erika.mueller@example.org");
		expect(tenantRow?.href).toBe(`/mieter#tenant-${tenant.id}`);

		// Der Mietvertrag ist über Mieter- und Einheitsnamen auffindbar und
		// verweist auf den Anker der Vertragsliste.
		const leaseHits = searchDatabase("erika");
		const leaseRow = leaseHits.find((row) => row.type === "lease");
		expect(leaseRow?.id).toBe(lease.id);
		expect(leaseRow?.href).toBe(`/vertraege#lease-${lease.id}`);
		expect(leaseRow?.subtitle).toContain("Lindenhöfe");

		// Einheiten sind über die zugehörige Liegenschaft auffindbar.
		const unitHits = searchDatabase("lindenhöfe");
		expect(unitHits.some((row) => row.type === "unit" && row.id === unit.id)).toBe(true);
	});

	it("findet Tickets über Titel und Dokumente über Dateinamen", () => {
		const { property, unit } = seedBaseData();
		const ticket = createTicket({
			propertyId: property.id,
			unitId: unit.id,
			title: "Heizung defekt",
			description: null,
			status: "OPEN",
			contractorNotes: null,
			resolvedAt: null,
		});
		const document = createDocument({
			propertyId: property.id,
			unitId: unit.id,
			tenantId: null,
			type: "INVOICE",
			fileName: "Jahresabrechnung 2025.pdf",
			filePath: "files/test.pdf",
			mimeType: "application/pdf",
			fileSize: 1000,
		});

		const ticketHits = searchDatabase("heizung");
		const ticketRow = ticketHits.find((row) => row.type === "ticket");
		expect(ticketRow?.id).toBe(ticket.id);
		expect(ticketRow?.href).toBe(`/tickets/${ticket.id}`);

		const documentHits = searchDatabase("jahresabrechnung 2025");
		const documentRow = documentHits.find((row) => row.type === "document");
		expect(documentRow?.id).toBe(document.id);
		// Dokument-Treffer verweisen auf die vorgefilterte Dokumentenliste.
		expect(documentRow?.href).toBe(`/dokumente?q=${encodeURIComponent("Jahresabrechnung 2025.pdf")}`);
	});

	it("findet Dokumente über den OCR-Volltext (SQL-LIKE-Pfad)", () => {
		const { property } = seedBaseData();
		const document = createDocument({
			propertyId: property.id,
			unitId: null,
			tenantId: null,
			type: "OTHER",
			fileName: "Scan.pdf",
			filePath: "files/scan.pdf",
			mimeType: "application/pdf",
			fileSize: 2000,
		});
		// OCR-Text direkt setzen (das Repository nimmt beim Anlegen keinen mit).
		getDb().prepare("UPDATE documents SET ocr_text = ? WHERE id = ?").run("Rechnung der Stadtwerke Musterstadt", document.id);

		const hits = searchDatabase("stadtwerke");
		const row = hits.find((hit) => hit.type === "document");
		expect(row?.id).toBe(document.id);
	});

	it("findet WEG-Daten (Eigentümer, WEG, Abrechnungsperiode) und Wissensartikel", () => {
		const { property } = seedBaseData();
		const owner = createOwner({
			firstName: "Klaus",
			lastName: "Schmidt",
			isCompany: false,
			companyName: null,
			street: "Weg 1",
			zipCode: "10115",
			city: "Berlin",
			country: "Deutschland",
			email: "klaus@example.org",
			phone: null,
			notes: null,
		});
		const hoa = createHoa({
			propertyId: property.id,
			name: "WEG Lindenhöfe",
			totalShares: 1000,
			bankIban: null,
			bankBic: null,
			notes: null,
		});
		const billingPeriod = createBillingPeriod({
			propertyId: property.id,
			periodFrom: "2025-01-01",
			periodTo: "2025-12-31",
			notes: null,
		});
		const article = createKnowledgeBaseArticle({
			title: "Übergabeprotokoll anlegen",
			category: "Verwaltung",
			content: "Blindtext",
		});

		const ownerRow = searchDatabase("schmidt").find((row) => row.type === "owner");
		expect(ownerRow?.id).toBe(owner.id);
		expect(ownerRow?.href).toBe(`/weg/eigentuemer#owner-${owner.id}`);

		const hoaRow = searchDatabase("weg lindenhöfe").find((row) => row.type === "hoa");
		expect(hoaRow?.id).toBe(hoa.id);
		expect(hoaRow?.href).toBe(`/weg#hoa-${hoa.id}`);

		// Abrechnungsperioden sind über das Jahr (ISO-Präfix) auffindbar.
		const billingRow = searchDatabase("2025").find((row) => row.type === "billingPeriod");
		expect(billingRow?.id).toBe(billingPeriod.id);
		expect(billingRow?.href).toBe(`/abrechnung/${billingPeriod.id}`);

		const articleRow = searchDatabase("übergabeprotokoll").find((row) => row.type === "knowledgeArticle");
		expect(articleRow?.id).toBe(article.id);
		expect(articleRow?.href).toBe(`/wissen/${article.id}`);
	});

	it("durchsucht Benutzerkonten nur mit includeUsers (Admin-Gating)", () => {
		seedBaseData();
		createUser({ email: "admin@example.org", passwordHash: "hash", role: "ADMIN", isApproved: true });

		expect(searchDatabase("admin@example.org", { includeUsers: false })).toHaveLength(0);

		const hits = searchDatabase("admin@example.org", { includeUsers: true });
		const userRow = hits.find((row) => row.type === "user");
		expect(userRow?.title).toBe("admin@example.org");
		expect(userRow?.href).toBe("/admin/users");
	});

	it("begrenzt die Treffer je Entitätsart auf das Limit", () => {
		const { property } = seedBaseData();
		for (let index = 0; index < 7; index += 1) {
			createTicket({
				propertyId: property.id,
				unitId: null,
				title: `Wasserschaden Raum ${index}`,
				description: null,
				status: "OPEN",
				contractorNotes: null,
				resolvedAt: null,
			});
		}

		const hits = searchDatabase("wasserschaden");
		expect(hits).toHaveLength(5);

		const hitsWithLimit = searchDatabase("wasserschaden", { limitPerType: 3 });
		expect(hitsWithLimit).toHaveLength(3);
	});

	it("liefert bei zu kurzen oder leeren Anfragen nichts", () => {
		seedBaseData();
		expect(searchDatabase("")).toHaveLength(0);
		expect(searchDatabase("   ")).toHaveLength(0);
		expect(searchDatabase("m")).toHaveLength(0);
	});
});
