import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDb } from "@/data/db";
import { createCalendarEvent, deleteCalendarEvent, getCalendarEvent, listCalendarEvents, updateCalendarEvent } from "@/data/calendar-events";
import {
	createKnowledgeBaseArticle,
	deleteKnowledgeBaseArticle,
	getKnowledgeBaseArticle,
	listKnowledgeBaseArticles,
	listKnowledgeBaseCategories,
	updateKnowledgeBaseArticle,
} from "@/data/knowledge-base";

/**
 * Repository-Tests für Kalender-Ereignisse und Wissensdatenbank gegen
 * eine echte (temporäre) better-sqlite3-Datenbank: CRUD-Roundtrips,
 * Zeitraum-Filter des Kalenders und LIKE-Suche der Wissensdatenbank.
 */

let testDir: string;

beforeEach(() => {
	testDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-cal-kb-test-"));
	process.env.APP_DATA_DIR = testDir;
});

afterEach(() => {
	closeDb();
	fs.rmSync(testDir, { recursive: true, force: true });
});

describe("Kalender-Ereignisse (src/data/calendar-events.ts)", () => {
	it("legt Ereignisse an, liest, aktualisiert und löscht sie", () => {
		const event = createCalendarEvent({ title: "Heizungswartung", description: "Keller", startDate: "2026-03-10", endDate: null });
		expect(event.id).toBeTruthy();
		expect(event.endDate).toBeNull();

		const loaded = getCalendarEvent(event.id);
		expect(loaded?.title).toBe("Heizungswartung");
		expect(loaded?.description).toBe("Keller");

		updateCalendarEvent(event.id, { title: "Wartung Heizung", description: null, startDate: "2026-03-11", endDate: "2026-03-12" });
		const updated = getCalendarEvent(event.id);
		expect(updated?.title).toBe("Wartung Heizung");
		expect(updated?.startDate).toBe("2026-03-11");
		expect(updated?.endDate).toBe("2026-03-12");

		deleteCalendarEvent(event.id);
		expect(getCalendarEvent(event.id)).toBeNull();
	});

	it("filtert den sichtbaren Zeitraum inklusive überlappender mehrtägiger Ereignisse", () => {
		createCalendarEvent({ title: "Vorher", description: null, startDate: "2026-02-01", endDate: null });
		createCalendarEvent({ title: "Im Monat", description: null, startDate: "2026-03-15", endDate: null });
		// Startet vor dem Zeitraum, läuft aber hinein -> sichtbar.
		createCalendarEvent({ title: "Überspannend", description: null, startDate: "2026-02-25", endDate: "2026-03-03" });
		createCalendarEvent({ title: "Danach", description: null, startDate: "2026-04-01", endDate: null });

		const march = listCalendarEvents({ from: "2026-03-01", to: "2026-03-31" });
		expect(march.map((event) => event.title)).toEqual(["Überspannend", "Im Monat"]);

		expect(listCalendarEvents()).toHaveLength(4);
	});
});

describe("Wissensdatenbank (src/data/knowledge-base.ts)", () => {
	it("legt Artikel an, liest, aktualisiert und löscht sie", () => {
		const article = createKnowledgeBaseArticle({ title: "Richtlinie Kaution", category: "Finanzen", content: "Maximal drei Nettokaltmieten." });
		expect(article.id).toBeTruthy();

		const loaded = getKnowledgeBaseArticle(article.id);
		expect(loaded?.title).toBe("Richtlinie Kaution");
		expect(loaded?.category).toBe("Finanzen");

		updateKnowledgeBaseArticle(article.id, { title: "Richtlinie Kaution (neu)", category: null, content: "Aktualisiert." });
		const updated = getKnowledgeBaseArticle(article.id);
		expect(updated?.title).toBe("Richtlinie Kaution (neu)");
		expect(updated?.category).toBeNull();

		deleteKnowledgeBaseArticle(article.id);
		expect(getKnowledgeBaseArticle(article.id)).toBeNull();
	});

	it("durchsucht Titel, Kategorie und Inhalt", () => {
		createKnowledgeBaseArticle({ title: "Mieterhöhung", category: "Mietrecht", content: "Kappungsgrenze beachten." });
		createKnowledgeBaseArticle({ title: "Übergabeprotokoll", category: "Prozesse", content: "Immer Fotos anfertigen." });
		createKnowledgeBaseArticle({ title: "Nebenkosten", category: "Abrechnung", content: "Fristen nach § 556 BGB." });

		expect(listKnowledgeBaseArticles({ search: "Kappungsgrenze" }).map((a) => a.title)).toEqual(["Mieterhöhung"]);
		expect(listKnowledgeBaseArticles({ search: "Mietrecht" }).map((a) => a.title)).toEqual(["Mieterhöhung"]);
		expect(listKnowledgeBaseArticles({ search: "protokoll" }).map((a) => a.title)).toEqual(["Übergabeprotokoll"]);
		expect(listKnowledgeBaseArticles({ search: "gibt-es-nicht" })).toEqual([]);
		expect(listKnowledgeBaseArticles()).toHaveLength(3);
	});

	it("listet die vergebenen Kategorien alphabetisch ohne Duplikate", () => {
		createKnowledgeBaseArticle({ title: "A", category: "Zeta", content: "x" });
		createKnowledgeBaseArticle({ title: "B", category: "Alpha", content: "x" });
		createKnowledgeBaseArticle({ title: "C", category: "Zeta", content: "x" });
		createKnowledgeBaseArticle({ title: "D", category: null, content: "x" });

		expect(listKnowledgeBaseCategories()).toEqual(["Alpha", "Zeta"]);
	});
});
