import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDb } from "@/data/db";
import { createProperty, getProperty, listProperties } from "@/data/properties";
import { createHoa } from "@/data/hoas";
import { createOwner as createOwnerRepo } from "@/data/owners";
import { createUnit, getUnit } from "@/data/units";
import { createUser, getUserById } from "@/data/users";
import { createBillingPeriod, getBillingPeriod } from "@/data/billing";
import { getAnnualStatement } from "@/data/annual-statements";
import { createOwnerMeeting, getOwnerResolution } from "@/data/meetings";
import { getOpenUnitOwnership, listUnitsWithOwnerships } from "@/data/unit-ownerships";
import { createLease } from "@/data/leases";
import { createTenant } from "@/data/tenants";
import { listTransactions } from "@/data/transactions";
import { generateMcpToken, isMcpEnabled, resolveMcpTokenScope, setMcpEnabled, clearMcpToken } from "@/lib/mcp/auth";
import { handleMcpPost } from "@/lib/mcp/protocol";
import { callTool } from "@/lib/mcp/tools";

/**
 * Tests für den MCP-Server: Token/Enabled-Konfiguration (beide Token-
 * Stufen), JSON-RPC-Protokollschicht (initialize, tools/list, tools/call,
 * Batches, Fehlerfälle), die Scope-Filterung der Werkzeuge (ADMIN vs.
 * USER) sowie repräsentative Werkzeug-Durchstiche gegen eine echte
 * (temporäre) Datenbank inkl. der gespiegelten Fachregeln (Entwurfs-
 * Sperren, Beschluss-Nummerierung, Eigentümerwechsel, Aussperr-Schutz).
 */

let testDir: string;

beforeEach(() => {
	testDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-mcp-test-"));
	process.env.APP_DATA_DIR = testDir;
});

afterEach(() => {
	closeDb();
	fs.rmSync(testDir, { recursive: true, force: true });
});

async function callToolViaProtocol(name: string, args: Record<string, unknown>) {
	const result = await handleMcpPost(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }));
	expect(result.status).toBe(200);
	return result.body as {
		result?: { content: { type: string; text: string }[]; isError: boolean };
	};
}

function toolResultText(body: Awaited<ReturnType<typeof callToolViaProtocol>>): string {
	return body.result?.content[0]?.text ?? "";
}

function seedHoa() {
	const property = createProperty({ name: "WEG Muster", street: "Str. 1", zipCode: "12345", city: "Berlin", country: "Deutschland", notes: null });
	const hoa = createHoa({ propertyId: property.id, name: "WEG Muster", totalShares: 1000, bankIban: null, bankBic: null, notes: null });
	return { property, hoa };
}

describe("MCP-Konfiguration (src/lib/mcp/auth.ts)", () => {
	it("ist standardmäßig deaktiviert und ohne Token", () => {
		expect(isMcpEnabled()).toBe(false);
		expect(resolveMcpTokenScope("irgendwas")).toBeNull();
	});

	it("aktiviert/deaktiviert und verwaltet das Admin-Token", () => {
		setMcpEnabled(true);
		expect(isMcpEnabled()).toBe(true);

		const token = generateMcpToken();
		expect(token.length).toBeGreaterThan(30);
		expect(resolveMcpTokenScope(token)).toBe("ADMIN");
		expect(resolveMcpTokenScope("falsches-token")).toBeNull();
		expect(resolveMcpTokenScope(null)).toBeNull();
		expect(resolveMcpTokenScope("")).toBeNull();

		// Rotation: altes Token ungültig, neues gültig.
		const rotated = generateMcpToken();
		expect(resolveMcpTokenScope(token)).toBeNull();
		expect(resolveMcpTokenScope(rotated)).toBe("ADMIN");

		clearMcpToken();
		expect(resolveMcpTokenScope(rotated)).toBeNull();

		setMcpEnabled(false);
		expect(isMcpEnabled()).toBe(false);
	});

	it("verwaltet beide Token-Stufen getrennt und löst den Scope korrekt auf", () => {
		const adminToken = generateMcpToken("ADMIN");
		const userToken = generateMcpToken("USER");

		expect(resolveMcpTokenScope(adminToken)).toBe("ADMIN");
		expect(resolveMcpTokenScope(userToken)).toBe("USER");
		expect(resolveMcpTokenScope("anderes-token")).toBeNull();

		// Rotation des Nutzer-Tokens lässt das Admin-Token unberührt (und umgekehrt).
		const rotatedUserToken = generateMcpToken("USER");
		expect(resolveMcpTokenScope(userToken)).toBeNull();
		expect(resolveMcpTokenScope(rotatedUserToken)).toBe("USER");
		expect(resolveMcpTokenScope(adminToken)).toBe("ADMIN");

		clearMcpToken("USER");
		expect(resolveMcpTokenScope(rotatedUserToken)).toBeNull();
		expect(resolveMcpTokenScope(adminToken)).toBe("ADMIN");
	});
});

describe("MCP-Protokollschicht (src/lib/mcp/protocol.ts)", () => {
	it("initialize handelt die Protokollversion aus und meldet Capabilities", async () => {
		const result = await handleMcpPost(JSON.stringify({ jsonrpc: "2.0", id: 7, method: "initialize", params: { protocolVersion: "2025-03-26" } }));
		expect(result.status).toBe(200);
		const body = result.body as { result: { protocolVersion: string; capabilities: { tools: unknown }; serverInfo: { name: string } } };
		expect(body.result.protocolVersion).toBe("2025-03-26");
		expect(body.result.capabilities.tools).toBeDefined();
		expect(body.result.serverInfo.name).toBe("immobase");
	});

	it("beantwortet ping und Notifications (202 ohne Body)", async () => {
		const ping = await handleMcpPost(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }));
		expect(ping.status).toBe(200);

		const notification = await handleMcpPost(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }));
		expect(notification.status).toBe(202);
		expect(notification.body).toBeUndefined();
	});

	it("tools/list liefert alle registrierten Werkzeuge inkl. Schemas", async () => {
		const result = await handleMcpPost(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }));
		const body = result.body as { result: { tools: { name: string; description: string; inputSchema: { type: string } }[] } };
		const names = body.result.tools.map((tool) => tool.name);

		// Stichproben aus allen Bereichen (Mietverwaltung, WEG, System).
		for (const expected of [
			"properties_list",
			"properties_create",
			"leases_update",
			"transactions_generate_due",
			"documents_upload",
			"billing_periods_finalize",
			"hoas_create",
			"economic_plans_generate_housing_charges",
			"annual_statements_finalize",
			"owner_resolutions_create",
			"users_set_approval",
			"company_settings_update",
		]) {
			expect(names).toContain(expected);
		}
		expect(body.result.tools.length).toBeGreaterThan(60);
		for (const tool of body.result.tools) {
			expect(tool.description.length).toBeGreaterThan(0);
			expect(tool.inputSchema.type).toBe("object");
		}
	});

	it("meldet unbekannte Methoden als JSON-RPC-Fehler -32601", async () => {
		const result = await handleMcpPost(JSON.stringify({ jsonrpc: "2.0", id: 3, method: "resources/list" }));
		const body = result.body as { error: { code: number } };
		expect(body.error.code).toBe(-32601);
	});

	it("meldet ungültiges JSON als Parse-Fehler -32700", async () => {
		const result = await handleMcpPost("{ nicht json");
		expect(result.status).toBe(400);
		const body = result.body as { error: { code: number } };
		expect(body.error.code).toBe(-32700);
	});

	it("unterstützt Batch-Anfragen", async () => {
		const result = await handleMcpPost(
			JSON.stringify([
				{ jsonrpc: "2.0", id: 1, method: "ping" },
				{ jsonrpc: "2.0", id: 2, method: "tools/list" },
				{ jsonrpc: "2.0", method: "notifications/initialized" },
			])
		);
		expect(result.status).toBe(200);
		// Die Notification erzeugt keine Antwort - nur 2 von 3 Einträgen.
		expect(Array.isArray(result.body)).toBe(true);
		expect((result.body as unknown[]).length).toBe(2);
	});
});

describe("MCP-Werkzeug-Scope (ADMIN vs. USER)", () => {
	it("tools/list blendet Admin-Werkzeuge im Scope USER aus", async () => {
		const result = await handleMcpPost(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }), "USER");
		const body = result.body as { result: { tools: { name: string }[] } };
		const names = body.result.tools.map((tool) => tool.name);

		// Fachliche Werkzeuge bleiben sichtbar...
		for (const expected of ["properties_list", "leases_update", "hoas_create", "calendar_list", "knowledge_articles_create"]) {
			expect(names).toContain(expected);
		}
		// ...Administrations-Werkzeuge dagegen nicht.
		for (const hidden of ["users_list", "users_set_approval", "company_settings_get", "company_settings_update"]) {
			expect(names).not.toContain(hidden);
		}
	});

	it("initialize weist im Scope USER auf die Einschränkung hin", async () => {
		const result = await handleMcpPost(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }), "USER");
		const body = result.body as { result: { instructions: string } };
		expect(body.result.instructions).toContain("eingeschränkte Rechte");

		const adminResult = await handleMcpPost(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }), "ADMIN");
		const adminBody = adminResult.body as { result: { instructions: string } };
		expect(adminBody.result.instructions).not.toContain("eingeschränkte Rechte");
	});

	it("tools/call sperrt Admin-Werkzeuge im Scope USER (isError-Result)", async () => {
		const result = await handleMcpPost(
			JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "users_list", arguments: {} } }),
			"USER"
		);
		const body = result.body as { result: { isError: boolean; content: { text: string }[] } };
		expect(body.result.isError).toBe(true);
		expect(body.result.content[0].text).toContain("nur Administratoren");
	});

	it("tools/call erlaubt fachliche Werkzeuge im Scope USER", async () => {
		const result = await handleMcpPost(
			JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "tools/call",
				params: { name: "properties_create", arguments: { name: "Haus", street: "S", zipCode: "1", city: "C", country: "D" } },
			}),
			"USER"
		);
		const body = result.body as { result: { isError: boolean; content: { text: string }[] } };
		expect(body.result.isError).toBe(false);
		expect(body.result.content[0].text).toContain('"id"');
	});

	it("callTool erzwingt den Scope auch bei direktem Aufruf", async () => {
		await expect(callTool("users_set_approval", { userId: "x", isApproved: true }, "USER")).rejects.toThrow(/nur Administratoren/);
		await expect(callTool("company_settings_update", { name: "X", street: "S", zipCode: "1", city: "C" }, "USER")).rejects.toThrow(
			/nur Administratoren/
		);
		// Im Admin-Scope (Default) bleiben sie aufrufbar.
		expect(((await callTool("users_list", {})) as unknown[]).length).toBe(0);
	});
});

describe("MCP-Meta-Werkzeug batch_execute", () => {
	interface BatchResult {
		total: number;
		executed: number;
		succeeded: number;
		failed: number;
		stoppedEarly: boolean;
		results: { index: number; name: string | null; ok: boolean; result?: unknown; error?: string }[];
	}

	it("führt mehrere Aufrufe gebündelt aus und meldet Erfolg/Fehler je Eintrag", async () => {
		const batch = (await callTool("batch_execute", {
			calls: [
				{ name: "properties_create", arguments: { name: "Haus A", street: "S", zipCode: "1", city: "C", country: "D" } },
				{ name: "properties_create", arguments: { name: "Haus B", street: "S", zipCode: "1", city: "C", country: "D" } },
				// Pflichtfeld fehlt -> fachlicher Fehler dieses einen Aufrufs.
				{ name: "properties_create", arguments: { street: "S" } },
				{ name: "properties_list" },
			],
		})) as BatchResult;

		expect(batch.total).toBe(4);
		expect(batch.executed).toBe(4);
		expect(batch.succeeded).toBe(3);
		expect(batch.failed).toBe(1);
		expect(batch.stoppedEarly).toBe(false);

		// Fehler bricht den Batch NICHT ab: die Liste danach liefert beide Anlagen.
		expect(batch.results[2].ok).toBe(false);
		expect(batch.results[2].error).toContain('Pflichtfeld "name"');
		const listResult = batch.results[3].result as { name: string }[];
		expect(listResult.map((property) => property.name).sort()).toEqual(["Haus A", "Haus B"]);

		// Erfolgreiche Unteraufrufe liefern ihr reguläres Ergebnis (inkl. ID).
		const created = batch.results[0].result as { id: string };
		expect(created.id).toBeTruthy();
	});

	it("bricht mit stopOnError nach dem ersten Fehler ab und überspringt den Rest", async () => {
		const batch = (await callTool("batch_execute", {
			stopOnError: true,
			calls: [
				{ name: "properties_create", arguments: { name: "Haus A", street: "S", zipCode: "1", city: "C", country: "D" } },
				{ name: "properties_create", arguments: { street: "S" } },
				{ name: "properties_create", arguments: { name: "Haus C", street: "S", zipCode: "1", city: "C", country: "D" } },
			],
		})) as BatchResult;

		expect(batch.total).toBe(3);
		expect(batch.executed).toBe(2);
		expect(batch.succeeded).toBe(1);
		expect(batch.failed).toBe(1);
		expect(batch.stoppedEarly).toBe(true);
		// Der dritte Aufruf wurde nie ausgeführt.
		expect(listProperties().map((property) => property.name)).toEqual(["Haus A"]);
	});

	it("sperrt Verschachtelung (batch_execute im Batch) je Eintrag", async () => {
		const batch = (await callTool("batch_execute", {
			calls: [
				{ name: "batch_execute", arguments: { calls: [{ name: "properties_list" }] } },
				{ name: "properties_list" },
			],
		})) as BatchResult;

		expect(batch.results[0].ok).toBe(false);
		expect(batch.results[0].error).toContain("Verschachtelte Batches");
		expect(batch.results[1].ok).toBe(true);
	});

	it("erzwingt den Scope je Unteraufruf (Admin-Werkzeug im USER-Scope scheitert einzeln)", async () => {
		const batch = (await callTool(
			"batch_execute",
			{
				calls: [
					{ name: "users_list" },
					{ name: "properties_create", arguments: { name: "Haus", street: "S", zipCode: "1", city: "C", country: "D" } },
				],
			},
			"USER"
		)) as BatchResult;

		expect(batch.results[0].ok).toBe(false);
		expect(batch.results[0].error).toContain("nur Administratoren");
		expect(batch.results[1].ok).toBe(true);
	});

	it("meldet unbekannte Werkzeuge und formal ungültige Einträge je Eintrag", async () => {
		const batch = (await callTool("batch_execute", {
			calls: [
				{ name: "gibt_es_nicht" },
				{ keinName: true },
				{ name: "properties_list", arguments: "kein-objekt" },
			],
		})) as BatchResult;

		expect(batch.failed).toBe(3);
		expect(batch.results[0].error).toContain("Unbekanntes Werkzeug");
		expect(batch.results[1].name).toBeNull();
		expect(batch.results[1].error).toContain('"name"');
		expect(batch.results[2].error).toContain('"arguments" muss ein JSON-Objekt');
	});

	it("lehnt formal ungültige Batch-Argumente als Ganzes ab (McpToolError)", async () => {
		await expect(callTool("batch_execute", {})).rejects.toThrow(/"calls" muss ein nicht-leeres Array/);
		await expect(callTool("batch_execute", { calls: [] })).rejects.toThrow(/nicht-leeres Array/);
		await expect(callTool("batch_execute", { calls: "kein-array" })).rejects.toThrow(/nicht-leeres Array/);
		await expect(callTool("batch_execute", { calls: [{ name: "properties_list" }], schmarn: 1 })).rejects.toThrow(/Unbekannte Feld/);
		await expect(callTool("batch_execute", { calls: [{ name: "properties_list" }], stopOnError: "ja" })).rejects.toThrow(
			/"stopOnError" muss ein Boolean/
		);
		// Mehr als 50 Aufrufe werden abgelehnt.
		const tooMany = Array.from({ length: 51 }, () => ({ name: "properties_list" }));
		await expect(callTool("batch_execute", { calls: tooMany })).rejects.toThrow(/höchstens 50/);
	});

	it("ist über das Protokoll aufrufbar und in tools/list sichtbar (auch im Scope USER)", async () => {
		const list = await handleMcpPost(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }), "USER");
		const names = (list.body as { result: { tools: { name: string }[] } }).result.tools.map((tool) => tool.name);
		expect(names).toContain("batch_execute");

		const body = await callToolViaProtocol("batch_execute", {
			calls: [{ name: "properties_create", arguments: { name: "Haus", street: "S", zipCode: "1", city: "C", country: "D" } }],
		});
		expect(body.result?.isError).toBe(false);
		expect(toolResultText(body)).toContain('"succeeded": 1');
		expect(listProperties()).toHaveLength(1);
	});
});

describe("MCP-Werkzeuge: CRUD-Durchstich und Validierung", () => {
	it("properties: kompletter CRUD-Roundtrip über callTool", async () => {
		const created = (await callTool("properties_create", {
			name: "MCP-Haus",
			street: "Testweg 5",
			zipCode: "10115",
			city: "Berlin",
			country: "Deutschland",
		})) as { id: string };
		expect(created.id).toBeTruthy();
		expect(listProperties()).toHaveLength(1);

		await callTool("properties_update", {
			id: created.id,
			name: "MCP-Haus (renoviert)",
			street: "Testweg 5",
			zipCode: "10115",
			city: "Berlin",
			country: "Deutschland",
			notes: null,
		});
		expect(getProperty(created.id)?.name).toBe("MCP-Haus (renoviert)");

		const list = (await callTool("properties_list", {})) as unknown[];
		expect(list).toHaveLength(1);

		await callTool("properties_delete", { id: created.id });
		expect(listProperties()).toHaveLength(0);
	});

	it("normalisiert Beträge (Zahl, Komma) und lehnt unbekannte Felder ab", async () => {
		const property = createProperty({ name: "Haus", street: "S", zipCode: "1", city: "C", country: "D", notes: null });
		const unit = (await callTool("units_create", { propertyId: property.id, label: "Whg 1", livingSpace: "65,5" })) as { id: string };
		expect(getUnit(unit.id)?.livingSpace).toBe(65.5);

		await expect(callTool("properties_create", { name: "X", street: "S", zipCode: "1", city: "C", country: "D", schmarn: 1 })).rejects.toThrow(
			/Unbekannte Feld/
		);
		await expect(callTool("units_create", { propertyId: property.id })).rejects.toThrow(/Pflichtfeld "label"/);
		await expect(callTool("units_create", { propertyId: "existiert-nicht", label: "X" })).rejects.toThrow(/Liegenschaft existiert nicht/);
	});

	it("meldet fachliche Fehler über das Protokoll als isError-Result", async () => {
		const body = await callToolViaProtocol("properties_get", { id: "gibts-nicht" });
		expect(body.result?.isError).toBe(true);
		expect(toolResultText(body)).toContain("wurde nicht gefunden");

		const unknownTool = await callToolViaProtocol("gibt_es_nicht", {});
		expect(unknownTool.result?.isError).toBe(true);
	});

	it("transactions_generate_due: erzeugt Monatsmieten für aktive Verträge (Duplikat-sicher)", async () => {
		const property = createProperty({ name: "Haus", street: "S", zipCode: "1", city: "C", country: "D", notes: null });
		const unit = createUnit({ propertyId: property.id, label: "Whg 1", livingSpace: 60, rooms: 2, floor: null, coOwnershipShare: null });
		const tenant = createTenant({ firstName: "Max", lastName: "Muster", email: null, phone: null, notes: null });
		createLease({
			unitId: unit.id,
			tenantId: tenant.id,
			startDate: new Date("2026-01-01").toISOString(),
			endDate: null,
			coldRent: "800.00",
			serviceCharges: "150.00",
			numberOfOccupants: 1,
			deposit: null,
			notes: null,
		});

		const first = (await callTool("transactions_generate_due", { fromMonth: "2026-02", toMonth: "2026-03", dueDay: 3 })) as {
			created: number;
			skipped: number;
		};
		expect(first.created).toBe(2);
		expect(first.skipped).toBe(0);
		expect(listTransactions()).toHaveLength(2);

		// Zweiter Lauf: alles Duplikate.
		const second = (await callTool("transactions_generate_due", { fromMonth: "2026-02", toMonth: "2026-03", dueDay: 3 })) as {
			created: number;
			skipped: number;
		};
		expect(second.created).toBe(0);
		expect(second.skipped).toBe(2);

		await expect(callTool("transactions_generate_due", { fromMonth: "2026-13", toMonth: "2026-03", dueDay: 3 })).rejects.toThrow(/Zeitraum/);
		await expect(callTool("transactions_generate_due", { fromMonth: "2026-02", toMonth: "2026-03", dueDay: 29 })).rejects.toThrow(/Fälligkeitstag/);
	});

	it("documents: Upload (Base64) -> Download-Roundtrip -> Löschen", async () => {
		const property = createProperty({ name: "Haus", street: "S", zipCode: "1", city: "C", country: "D", notes: null });
		const content = Buffer.from("Mietvertrag-Testinhalt", "utf8");

		const created = (await callTool("documents_upload", {
			fileName: "vertrag.txt",
			contentBase64: content.toString("base64"),
			type: "CONTRACT",
			propertyId: property.id,
		})) as { id: string };
		expect(created.id).toBeTruthy();

		const downloaded = (await callTool("documents_download", { id: created.id })) as { fileName: string; contentBase64: string };
		expect(downloaded.fileName).toBe("vertrag.txt");
		expect(Buffer.from(downloaded.contentBase64, "base64").toString("utf8")).toBe("Mietvertrag-Testinhalt");

		await callTool("documents_delete", { id: created.id });
		await expect(callTool("documents_get", { id: created.id })).rejects.toThrow(/nicht gefunden/);
	});

	it("billing_periods: Finalisierungs-Sperren; finalisierte Perioden bleiben löschbar, Notizen jederzeit pflegbar", async () => {
		const property = createProperty({ name: "Haus", street: "S", zipCode: "1", city: "C", country: "D", notes: null });
		const unit = createUnit({ propertyId: property.id, label: "Whg 1", livingSpace: 60, rooms: 2, floor: null, coOwnershipShare: null });
		const tenant = createTenant({ firstName: "Max", lastName: "Muster", email: null, phone: null, notes: null });
		createLease({
			unitId: unit.id,
			tenantId: tenant.id,
			startDate: new Date("2025-01-01").toISOString(),
			endDate: null,
			coldRent: "800.00",
			serviceCharges: "150.00",
			numberOfOccupants: 1,
			deposit: null,
			notes: null,
		});
		const period = createBillingPeriod({
			propertyId: property.id,
			periodFrom: new Date("2025-01-01").toISOString(),
			periodTo: new Date("2025-12-31").toISOString(),
			notes: null,
		});

		// Ohne Kostenpositionen ist die Finalisierung fachlich gesperrt.
		await expect(callTool("billing_periods_finalize", { id: period.id })).rejects.toThrow(/Kostenposition/);

		// Kostenposition anlegen und finalisieren.
		const costItem = (await callTool("billing_cost_items_create", {
			billingPeriodId: period.id,
			label: "Wasser",
			amount: "100.00",
			allocationKey: "UNITS",
			directUnitId: null,
			customAllocationKeyId: null,
			notes: null,
		})) as { id: string };
		await callTool("billing_periods_finalize", { id: period.id });
		expect(getBillingPeriod(period.id)?.status).toBe("FINALIZED");

		// Kostenpositionen/Periode sind gesperrt ...
		await expect(
			callTool("billing_periods_update", { id: period.id, propertyId: property.id, periodFrom: period.periodFrom, periodTo: period.periodTo, notes: null })
		).rejects.toThrow(/finalisiert/);
		await expect(
			callTool("billing_cost_items_update", {
				id: costItem.id,
				billingPeriodId: period.id,
				label: "Wasser",
				amount: "120.00",
				allocationKey: "UNITS",
				directUnitId: null,
				customAllocationKeyId: null,
				notes: null,
			})
		).rejects.toThrow(/finalisiert/);

		// ... aber die internen Notizen bleiben jederzeit pflegbar.
		await callTool("billing_periods_set_notes", { id: period.id, notes: "Geprüft am 05.03." });
		expect(getBillingPeriod(period.id)?.notes).toBe("Geprüft am 05.03.");

		// Finalisierte Perioden sind nicht mehr bearbeitbar, ihre Löschung
		// bleibt möglich (inkl. Abrechnungs-PDFs + Postversand-Protokolle).
		await callTool("billing_periods_delete", { id: period.id });
		expect(getBillingPeriod(period.id)).toBeNull();
	});

	it("custom_allocation_keys + billing_cost_items mit CUSTOM: Gewichte, Validierung, Umlage", async () => {
		const property = createProperty({ name: "Haus", street: "S", zipCode: "1", city: "C", country: "D", notes: null });
		const unit = createUnit({ propertyId: property.id, label: "Whg 1", livingSpace: 60, rooms: 2, floor: null, coOwnershipShare: null });

		const customKey = (await callTool("custom_allocation_keys_create", {
			propertyId: property.id,
			label: "Stellplätze",
			notes: null,
		})) as { id: string };
		await callTool("custom_allocation_keys_set_weight", { customAllocationKeyId: customKey.id, unitId: unit.id, weight: 2.5 });

		const keys = (await callTool("custom_allocation_keys_list", { propertyId: property.id })) as { weights: { unitId: string; weight: number }[] }[];
		expect(keys[0].weights[0]).toMatchObject({ unitId: unit.id, weight: 2.5 });

		const period = createBillingPeriod({
			propertyId: property.id,
			periodFrom: new Date("2026-01-01").toISOString(),
			periodTo: new Date("2026-12-31").toISOString(),
			notes: null,
		});

		// CUSTOM ohne customAllocationKeyId wird abgelehnt.
		await expect(
			callTool("billing_cost_items_create", {
				billingPeriodId: period.id,
				label: "Garage",
				amount: "50.00",
				allocationKey: "CUSTOM",
				directUnitId: null,
				customAllocationKeyId: null,
				notes: null,
			})
		).rejects.toThrow(/customAllocationKeyId/);

		// Individueller Schlüssel einer ANDEREN Liegenschaft wird abgelehnt.
		const otherProperty = createProperty({ name: "Anderes Haus", street: "S", zipCode: "1", city: "C", country: "D", notes: null });
		const otherKey = (await callTool("custom_allocation_keys_create", { propertyId: otherProperty.id, label: "Fremd", notes: null })) as { id: string };
		await expect(
			callTool("billing_cost_items_create", {
				billingPeriodId: period.id,
				label: "Garage",
				amount: "50.00",
				allocationKey: "CUSTOM",
				directUnitId: null,
				customAllocationKeyId: otherKey.id,
				notes: null,
			})
		).rejects.toThrow(/nicht zu der Liegenschaft/);

		const created = (await callTool("billing_cost_items_create", {
			billingPeriodId: period.id,
			label: "Garage",
			amount: "50.00",
			allocationKey: "CUSTOM",
			directUnitId: null,
			customAllocationKeyId: customKey.id,
			notes: null,
		})) as { customAllocationKeyId: string | null; allocationKey: string };
		expect(created.allocationKey).toBe("CUSTOM");
		expect(created.customAllocationKeyId).toBe(customKey.id);
	});

	it("buchhaltung: Kontoauszug-Import mit Zuordnung markiert Sollstellungen als bezahlt", async () => {
		const property = createProperty({ name: "Haus", street: "S", zipCode: "1", city: "C", country: "D", notes: null });
		const unit = createUnit({ propertyId: property.id, label: "Whg 1", livingSpace: 60, rooms: 2, floor: null, coOwnershipShare: null });
		const tenant = createTenant({ firstName: "Max", lastName: "Muster", email: null, phone: null, notes: null });
		createLease({
			unitId: unit.id,
			tenantId: tenant.id,
			startDate: new Date("2026-01-01").toISOString(),
			endDate: null,
			coldRent: "800.00",
			serviceCharges: "150.00",
			numberOfOccupants: 1,
			deposit: null,
			notes: null,
		});
		await callTool("transactions_generate_due", { fromMonth: "2026-02", toMonth: "2026-02", dueDay: 3 });

		const account = (await callTool("accounts_create", { propertyId: property.id, label: "Gebäudeversicherung", notes: null })) as { id: string };

		// Offene Sollstellungen der Liegenschaft über den propertyId-Filter ermitteln.
		const open = (await callTool("transactions_list", { propertyId: property.id, status: "OPEN" })) as { id: string; amount: string }[];
		expect(open).toHaveLength(1);

		const importResult = (await callTool("bank_transactions_import", {
			propertyId: property.id,
			transactions: [
				{
					bookingDate: "2026-02-05",
					amount: "950.00",
					description: "Überweisung Miete Februar",
					partner: "Max Muster",
					notes: null,
					allocations: [{ accountId: null, transactionId: open[0].id, amount: "950.00" }],
				},
				{
					bookingDate: "2026-02-10",
					amount: "-120.00",
					description: "Abbuchung Gebäudeversicherung",
					partner: "Versicherung AG",
					notes: null,
					allocations: [{ accountId: account.id, transactionId: null, amount: "-120.00" }],
				},
			],
		})) as { created: number };
		expect(importResult.created).toBe(2);

		// Die vollständig zugeordnete Sollstellung gilt als bezahlt.
		const transactions = listTransactions({ propertyId: property.id });
		expect(transactions[0].status).toBe("PAID");
		expect(transactions[0].paidDate).toBe(new Date("2026-02-05T00:00:00.000Z").toISOString());

		// Konten-Statistik + abgeleiteter Zuordnungsstatus.
		const accounts = (await callTool("accounts_list", { propertyId: property.id })) as { label: string; allocatedAmount: string; bookingCount: number }[];
		expect(accounts[0]).toMatchObject({ label: "Gebäudeversicherung", allocatedAmount: "-120.00", bookingCount: 1 });

		const reconciled = (await callTool("bank_transactions_list", { propertyId: property.id, status: "RECONCILED" })) as { id: string }[];
		expect(reconciled).toHaveLength(2);

		// Konto mit Buchungen ist über MCP löschgeschützt.
		await expect(callTool("accounts_delete", { id: account.id })).rejects.toThrow(/Buchungen/);
	});

	it("buchhaltung: Zuordnungs-Fachregeln (Vorzeichen, fremde Liegenschaft, Überzuordnung)", async () => {
		const propertyA = createProperty({ name: "Haus A", street: "S", zipCode: "1", city: "C", country: "D", notes: null });
		const propertyB = createProperty({ name: "Haus B", street: "S", zipCode: "1", city: "C", country: "D", notes: null });
		const unit = createUnit({ propertyId: propertyA.id, label: "Whg 1", livingSpace: 60, rooms: 2, floor: null, coOwnershipShare: null });
		const tenant = createTenant({ firstName: "Max", lastName: "Muster", email: null, phone: null, notes: null });
		const lease = createLease({
			unitId: unit.id,
			tenantId: tenant.id,
			startDate: new Date("2026-01-01").toISOString(),
			endDate: null,
			coldRent: "800.00",
			serviceCharges: "150.00",
			numberOfOccupants: 1,
			deposit: null,
			notes: null,
		});
		const due = (await callTool("transactions_generate_due", { fromMonth: "2026-02", toMonth: "2026-02", dueDay: 3 })) as { created: number };
		expect(due.created).toBe(1);
		const openA = (await callTool("transactions_list", { propertyId: propertyA.id, status: "OPEN" })) as { id: string }[];

		const bankTransaction = (await callTool("bank_transactions_create", {
			propertyId: propertyA.id,
			bookingDate: "2026-02-05",
			amount: "1000.00",
			description: "Eingang",
			partner: null,
			notes: null,
		})) as { id: string };

		// Vorzeichen der Buchungszeile muss dem der Banktransaktion entsprechen.
		await expect(
			callTool("bank_transactions_allocate", { id: bankTransaction.id, allocations: [{ accountId: null, transactionId: openA[0].id, amount: "-500.00" }] })
		).rejects.toThrow(/Vorzeichen/);

		// Sollstellung einer anderen Liegenschaft wird abgelehnt.
		const unitB = createUnit({ propertyId: propertyB.id, label: "Whg B", livingSpace: 60, rooms: 2, floor: null, coOwnershipShare: null });
		const tenantB = createTenant({ firstName: "Berta", lastName: "Beispiel", email: null, phone: null, notes: null });
		createLease({
			unitId: unitB.id,
			tenantId: tenantB.id,
			startDate: new Date("2026-01-01").toISOString(),
			endDate: null,
			coldRent: "700.00",
			serviceCharges: "120.00",
			numberOfOccupants: 1,
			deposit: null,
			notes: null,
		});
		await callTool("transactions_generate_due", { fromMonth: "2026-02", toMonth: "2026-02", dueDay: 3 });
		const openB = (await callTool("transactions_list", { propertyId: propertyB.id, status: "OPEN" })) as { id: string }[];
		await expect(
			callTool("bank_transactions_allocate", { id: bankTransaction.id, allocations: [{ accountId: null, transactionId: openB[0].id, amount: "500.00" }] })
		).rejects.toThrow(/anderen Liegenschaft/);

		// Überzuordnung wird abgelehnt.
		await expect(
			callTool("bank_transactions_allocate", { id: bankTransaction.id, allocations: [{ accountId: null, transactionId: openA[0].id, amount: "1200.00" }] })
		).rejects.toThrow(/übersteigen/);

		// Korrekte Zuordnung klappt (Split in Teilbeträge, Rest auf Konto).
		const account = (await callTool("accounts_create", { propertyId: propertyA.id, label: "Kaution", notes: null })) as { id: string };
		const allocateResult = (await callTool("bank_transactions_allocate", {
			id: bankTransaction.id,
			allocations: [
				{ accountId: null, transactionId: openA[0].id, amount: "950.00" },
				{ accountId: account.id, transactionId: null, amount: "50.00" },
			],
		})) as { success: boolean };
		expect(allocateResult.success).toBe(true);
		expect(listTransactions({ leaseId: lease.id })[0].status).toBe("PAID");
	});
});

describe("MCP-Werkzeuge: WEG-Fachregeln", () => {
	it("hoas: doppelte WEG-Zuordnung einer Liegenschaft wird abgelehnt", async () => {
		const { property } = seedHoa();
		await expect(
			callTool("hoas_create", { propertyId: property.id, name: "Zweite WEG", totalShares: 1000, bankIban: null, bankBic: null, notes: null })
		).rejects.toThrow(/bereits einer WEG zugeordnet/);
	});

	it("unit_ownerships_create beendet das bisher laufende Verhältnis automatisch", async () => {
		const { property } = seedHoa();
		const unit = createUnit({ propertyId: property.id, label: "Whg 1", livingSpace: 60, rooms: 2, floor: null, coOwnershipShare: 500 });
		const ownerA = createOwnerRepo({
			firstName: "A", lastName: "Alt", isCompany: false, companyName: null, street: "S", zipCode: "1", city: "C", country: "D", email: null, phone: null, notes: null,
		});
		const ownerB = createOwnerRepo({
			firstName: "B", lastName: "Neu", isCompany: false, companyName: null, street: "S", zipCode: "1", city: "C", country: "D", email: null, phone: null, notes: null,
		});

		await callTool("unit_ownerships_create", { unitId: unit.id, ownerId: ownerA.id, startDate: "2024-01-01" });
		expect(getOpenUnitOwnership(unit.id)?.ownerId).toBe(ownerA.id);

		// Eigentümerwechsel: altes Verhältnis wird am Vortag beendet.
		await callTool("unit_ownerships_create", { unitId: unit.id, ownerId: ownerB.id, startDate: "2025-06-01" });
		const open = getOpenUnitOwnership(unit.id);
		expect(open?.ownerId).toBe(ownerB.id);

		const all = listUnitsWithOwnerships().find((entry) => entry.id === unit.id)?.ownerships ?? [];
		expect(all).toHaveLength(2);
		const closed = all.find((ownership) => ownership.ownerId === ownerA.id);
		expect(closed?.endDate).toBeTruthy();

		// Rückwirkender Wechsel (vor dem laufenden Beginn) ist gesperrt.
		await expect(callTool("unit_ownerships_create", { unitId: unit.id, ownerId: ownerA.id, startDate: "2024-06-01" })).rejects.toThrow(
			/nach dem Beginn/
		);
	});

	it("owner_resolutions: automatische Nummernvergabe + Lösch-Sperre (nur letzter Beschluss)", async () => {
		const { hoa } = seedHoa();
		const meeting = createOwnerMeeting({ hoaId: hoa.id, title: "Ordentliche Versammlung", type: "ORDINARY", status: "HELD", meetingDate: null, location: null, notes: null });

		const first = (await callTool("owner_resolutions_create", {
			hoaId: hoa.id,
			meetingId: meeting.id,
			title: "Beschluss 1",
			content: "Text 1",
			votingResult: "ACCEPTED",
			resolvedAt: "2026-03-01",
		})) as { id: string; sequenceNumber: number; contestedUntil: string };
		expect(first.sequenceNumber).toBe(1);
		expect(first.contestedUntil).toBeTruthy();

		const second = (await callTool("owner_resolutions_create", {
			hoaId: hoa.id,
			meetingId: meeting.id,
			title: "Beschluss 2",
			content: "Text 2",
			votingResult: "REJECTED",
			resolvedAt: "2026-03-01",
		})) as { id: string; sequenceNumber: number };
		expect(second.sequenceNumber).toBe(2);

		// Nur der zuletzt erfasste Beschluss darf gelöscht werden.
		await expect(callTool("owner_resolutions_delete", { id: first.id })).rejects.toThrow(/zuletzt erfasste Beschluss/);
		await callTool("owner_resolutions_delete", { id: second.id });
		expect(getOwnerResolution(second.id)).toBeNull();
		expect(getOwnerResolution(first.id)).toBeTruthy();

		// Versammlung mit Beschluss ist ebenfalls löschgesperrt.
		await expect(callTool("owner_meetings_delete", { id: meeting.id })).rejects.toThrow(/Beschlüsse/);
	});

	it("economic_plans: Entwurfs-Sperren nach der Finalisierung", async () => {
		const { hoa, property } = seedHoa();
		createUnit({ propertyId: property.id, label: "Whg 1", livingSpace: 60, rooms: 2, floor: null, coOwnershipShare: 500 });
		createUnit({ propertyId: property.id, label: "Whg 2", livingSpace: 60, rooms: 2, floor: null, coOwnershipShare: 500 });

		const plan = (await callTool("economic_plans_create", {
			hoaId: hoa.id,
			fiscalYearFrom: "2026-01-01",
			fiscalYearTo: "2026-12-31",
		})) as { id: string };

		await callTool("economic_plan_cost_items_create", {
			economicPlanId: plan.id,
			label: "Gebäudeversicherung",
			amount: "1200.00",
			allocationKey: "MEA",
		});

		const finalized = (await callTool("economic_plans_finalize", { id: plan.id })) as { success: boolean; unitShares: number };
		expect(finalized.success).toBe(true);
		expect(finalized.unitShares).toBe(2);

		// Nach Finalisierung: Änderung/Löschung gesperrt, Hausgeld-Generierung möglich.
		await expect(
			callTool("economic_plans_update", { id: plan.id, hoaId: hoa.id, fiscalYearFrom: "2026-01-01", fiscalYearTo: "2026-12-31", notes: null })
		).rejects.toThrow(/finalisiert/);
		await expect(callTool("economic_plans_delete", { id: plan.id })).rejects.toThrow(/Entwurfsstatus/);
		await expect(callTool("economic_plans_finalize", { id: plan.id })).rejects.toThrow(/bereits finalisiert/);

		// Ohne Eigentümer werden keine Sollstellungen angelegt (übersprungen).
		const generated = (await callTool("economic_plans_generate_housing_charges", { economicPlanId: plan.id, dueDay: 1 })) as {
			created: number;
			skippedNoOwner: number;
		};
		expect(generated.created).toBe(0);
		expect(generated.skippedNoOwner).toBeGreaterThan(0);
	});

	it("jahresabrechnung: Notizen jederzeit, Banking-Import, Hausgeld-Zahlung per Bankbuchung, Konsistenzprüfung, Löschen finalisierter Abrechnungen", async () => {
		const { hoa, property } = seedHoa();
		const unit = createUnit({ propertyId: property.id, label: "Whg 1", livingSpace: 60, rooms: 2, floor: null, coOwnershipShare: 1000 });
		const owner = createOwnerRepo({
			firstName: "Erika", lastName: "Eigentümer", isCompany: false, companyName: null, street: "S", zipCode: "1", city: "C", country: "D", email: null, phone: null, notes: null,
		});
		await callTool("unit_ownerships_create", { unitId: unit.id, ownerId: owner.id, startDate: "2020-01-01" });

		// Konto + Kontobewegung (Versicherungsabbuchung) für den Banking-Import.
		const insuranceAccount = (await callTool("accounts_create", { propertyId: property.id, label: "Gebäudeversicherung", notes: null })) as { id: string };
		const insurancePayment = (await callTool("bank_transactions_create", {
			propertyId: property.id,
			bookingDate: "2026-03-05",
			amount: "-120.00",
			description: "Versicherung Jahresprämie",
			partner: null,
			notes: null,
		})) as { id: string };
		await callTool("bank_transactions_allocate", {
			id: insurancePayment.id,
			allocations: [{ accountId: insuranceAccount.id, transactionId: null, amount: "-120.00" }],
		});

		const statement = (await callTool("annual_statements_create", {
			hoaId: hoa.id,
			periodFrom: "2026-01-01",
			periodTo: "2026-12-31",
		})) as { id: string };

		// Notizen sind jederzeit änderbar - auch vor der Finalisierung.
		await callTool("annual_statements_set_notes", { id: statement.id, notes: "Beschlüsse der Versammlung vom 10.01. berücksichtigt" });

		// Banking-Import: je Konto eine Position (geteilte Logik mit der
		// Mietverwaltung), einheitlicher Verteilerschlüssel MEA.
		const imported = (await callTool("annual_statements_import_cost_items_from_banking", {
			annualStatementId: statement.id,
			allocationKey: "MEA",
		})) as { created: number; ids: string[] };
		expect(imported.created).toBe(1);

		// Hausgeld-Sollstellung + tatsächlicher Zahlungseingang: Die
		// vollständige Zuordnung per Bankbuchung markiert das Hausgeld als
		// bezahlt (Grlage: nur geleistete Zahlungen sind Vorauszahlung).
		const housingCharge = (await callTool("housing_charges_create", {
			unitId: unit.id,
			ownerId: owner.id,
			amount: "300.00",
			dueDate: "2026-02-01",
			paidDate: null,
			purpose: "Hausgeld Februar 2026",
			status: "OPEN",
		})) as { id: string; status: string };
		expect(housingCharge.status).toBe("OPEN");

		const ownerPayment = (await callTool("bank_transactions_create", {
			propertyId: property.id,
			bookingDate: "2026-02-05",
			amount: "300.00",
			description: "Hausgeldzahlung Februar",
			partner: "Erika Eigentümer",
			notes: null,
		})) as { id: string };
		await callTool("bank_transactions_allocate", {
			id: ownerPayment.id,
			allocations: [{ accountId: null, transactionId: null, housingChargeId: housingCharge.id, amount: "300.00" }],
		});
		const paidCharges = (await callTool("housing_charges_list", { unitId: unit.id })) as { id: string; status: string; paidDate: string | null }[];
		const paidCharge = paidCharges.find((charge) => charge.id === housingCharge.id)!;
		expect(paidCharge.status).toBe("PAID");
		expect(paidCharge.paidDate).toBe("2026-02-05T00:00:00.000Z");

		// Konsistenzprüfung vor der Finalisierung: keine unzugeordneten Kosten
		// (100 % Eigentum erfasst), keine Rückstände (Hausgeld bezahlt) -
		// nur der Hinweis auf den fehlenden finalisierten Wirtschaftsplan.
		const issuesBefore = (await callTool("annual_statements_consistency_check", { id: statement.id })) as { type: string }[];
		expect(issuesBefore.map((issue) => issue.type)).toEqual(["NO_ECONOMIC_PLAN"]);

		// Finalisierung friert die Einzelabrechnung ein (inkl. der tatsächlich
		// geleisteten Vorauszahlung) und meldet die Konsistenz-Hinweise mit.
		const finalized = (await callTool("annual_statements_finalize", { id: statement.id })) as {
			success: boolean;
			unitResults: number;
			consistencyIssues: { type: string }[];
		};
		expect(finalized.success).toBe(true);
		expect(finalized.unitResults).toBe(1);
		expect(finalized.consistencyIssues.map((issue) => issue.type)).toContain("NO_ECONOMIC_PLAN");

		const detail = (await callTool("annual_statements_get", { id: statement.id })) as {
			unitResults: { totalPrepayments: string; balance: string }[];
		};
		expect(detail.unitResults[0].totalPrepayments).toBe("300.00");
		// 120 € Kosten - 300 € Vorauszahlung = 180 € Guthaben.
		expect(detail.unitResults[0].balance).toBe("-180.00");

		// Nach der Finalisierung: Notizen bleiben editierbar (interne
		// Anmerkungen), Kostenpositionen sind gesperrt, Löschen geht weiterhin.
		await callTool("annual_statements_set_notes", { id: statement.id, notes: "Finalisiert und geprüft." });
		await expect(
			callTool("annual_statement_cost_items_create", {
				annualStatementId: statement.id,
				label: "Nachträglich",
				amount: "10.00",
				allocationKey: "MEA",
				isApportionable: true,
			})
		).rejects.toThrow(/finalisiert/);

		await callTool("annual_statements_delete", { id: statement.id });
		// Finalisierte Abrechnungen sind über MCP löschbar (inkl. Artefakt-Aufräumlogik).
		expect(getAnnualStatement(statement.id)).toBeNull();
	});
});

describe("MCP-Werkzeuge: Benutzerverwaltung", () => {
	it("users_list ohne Passwort-Hash; Aussperr-Schutz für den letzten Admin", async () => {
		const admin = createUser({ email: "admin@example.de", passwordHash: "hash", role: "ADMIN", isApproved: true });
		const user = createUser({ email: "user@example.de", passwordHash: "hash", role: "USER", isApproved: false });

		const users = (await callTool("users_list", {})) as { id: string; email: string; passwordHash?: string }[];
		expect(users).toHaveLength(2);
		expect(users[0].passwordHash).toBeUndefined();

		// Freigabe erteilen/entziehen für NORMAL-User funktioniert.
		await callTool("users_set_approval", { userId: user.id, isApproved: true });
		expect(getUserById(user.id)?.isApproved).toBe(true);

		// Letzter freigegebener Admin ist geschützt.
		await expect(callTool("users_set_approval", { userId: admin.id, isApproved: false })).rejects.toThrow(/letzten freigegebenen Administrator/);
	});
});

describe("MCP-Werkzeuge: Kalender und Wissensdatenbank", () => {
	it("calendar_events: CRUD-Roundtrip inkl. Datums- und Uhrzeit-Guards", async () => {
		const created = (await callTool("calendar_events_create", { title: "Wartung", startDate: "2026-03-10" })) as { id: string };
		expect(created.id).toBeTruthy();

		await callTool("calendar_events_update", { id: created.id, title: "Wartung Heizung", startDate: "2026-03-11", endDate: "2026-03-12", startTime: "09:30", endTime: "12:00" });
		const loaded = (await callTool("calendar_events_get", { id: created.id })) as { title: string; endDate: string; startTime: string | null; endTime: string | null };
		expect(loaded.title).toBe("Wartung Heizung");
		expect(loaded.startTime).toBe("09:30");
		expect(loaded.endTime).toBe("12:00");

		// Enddatum vor Startdatum wird abgelehnt.
		await expect(callTool("calendar_events_create", { title: "X", startDate: "2026-03-10", endDate: "2026-03-01" })).rejects.toThrow(
			/Enddatum/
		);
		// Uhrzeit-Guards: ungültiges Format, Enduhrzeit ohne bzw. vor Startuhrzeit (am selben Tag).
		await expect(callTool("calendar_events_create", { title: "X", startDate: "2026-03-10", startTime: "9:30" })).rejects.toThrow(/HH:MM/);
		await expect(callTool("calendar_events_create", { title: "X", startDate: "2026-03-10", endTime: "20:00" })).rejects.toThrow(/Startuhrzeit/);
		await expect(callTool("calendar_events_create", { title: "X", startDate: "2026-03-10", startTime: "18:00", endTime: "17:00" })).rejects.toThrow(
			/Enduhrzeit/
		);

		await callTool("calendar_events_delete", { id: created.id });
		expect((await callTool("calendar_events_list", {})) as unknown[]).toHaveLength(0);
	});

	it("calendar_list: aggregiert manuelle Ereignisse und automatische Termine", async () => {
		const property = createProperty({ name: "Haus", street: "S", zipCode: "1", city: "C", country: "D", notes: null });
		const unit = createUnit({ propertyId: property.id, label: "Whg 1", livingSpace: null, rooms: null, floor: null, coOwnershipShare: null });
		const tenant = createTenant({ firstName: "Max", lastName: "Muster", email: null, phone: null, notes: null });
		createLease({
			unitId: unit.id,
			tenantId: tenant.id,
			startDate: "2026-03-01",
			endDate: "2026-12-31",
			coldRent: "800.00",
			serviceCharges: "150.00",
			numberOfOccupants: 1,
			deposit: null,
			notes: null,
		});
		await callTool("calendar_events_create", { title: "Wartung", startDate: "2026-03-10" });

		// Sortierung nach Tag: Einzug (01.03.) vor dem manuellen Ereignis (10.03.).
		const march = (await callTool("calendar_list", { from: "2026-03-01", to: "2026-03-31" })) as { kind: string; title: string }[];
		expect(march.map((item) => item.kind)).toEqual(["LEASE_START", "MANUAL"]);

		// Auszug liegt außerhalb des Zeitraums.
		const all = (await callTool("calendar_list", {})) as { kind: string }[];
		expect(all.map((item) => item.kind).sort()).toEqual(["LEASE_END", "LEASE_START", "MANUAL"]);

		await expect(callTool("calendar_list", { from: "2026-04-01", to: "2026-03-01" })).rejects.toThrow(/darf nicht vor/);
	});

	it("knowledge_articles: CRUD-Roundtrip inkl. Suche", async () => {
		const created = (await callTool("knowledge_articles_create", {
			title: "Richtlinie Kaution",
			category: "Finanzen",
			content: "Maximal drei Nettokaltmieten.",
		})) as { id: string };
		expect(created.id).toBeTruthy();

		await callTool("knowledge_articles_update", { id: created.id, title: "Richtlinie Kaution (neu)", category: "Finanzen", content: "Aktualisiert." });
		const found = (await callTool("knowledge_articles_list", { search: "Aktualisiert" })) as { title: string }[];
		expect(found.map((article) => article.title)).toEqual(["Richtlinie Kaution (neu)"]);

		await callTool("knowledge_articles_delete", { id: created.id });
		expect((await callTool("knowledge_articles_list", {})) as unknown[]).toHaveLength(0);
	});
});
