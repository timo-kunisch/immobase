import { describe, expect, it } from "vitest";

import { buildTicketRef, buildTicketSubjectTag, ensureTicketSubjectTag, extractTicketRefsFromSubject } from "@/lib/ticket-ref";

/**
 * Reine Funktionen der Ticket-Kennung im E-Mail-Betreff (Fallback für die
 * automatische Zuordnung eingehender Antworten, wenn Threading-Header
 * fehlen oder verworfen wurden).
 */

const TICKET_ID = "a3f8b2c1-d4e5-6789-abcd-ef0123456789";

describe("ticket-ref (src/lib/ticket-ref.ts)", () => {
	it("baut Kennung und Betreff-Tag aus der Ticket-ID", () => {
		expect(buildTicketRef(TICKET_ID)).toBe("#a3f8b2c1");
		expect(buildTicketSubjectTag(TICKET_ID)).toBe("[#a3f8b2c1]");
	});

	it("hängt das Tag an den Betreff an, aber nicht doppelt", () => {
		expect(ensureTicketSubjectTag("Re: Heizung defekt", TICKET_ID)).toBe("Re: Heizung defekt [#a3f8b2c1]");
		expect(ensureTicketSubjectTag("Re: Heizung defekt [#a3f8b2c1]", TICKET_ID)).toBe("Re: Heizung defekt [#a3f8b2c1]");
		// Großschreibung im Betreff zählt ebenfalls als vorhanden.
		expect(ensureTicketSubjectTag("Re: Heizung defekt [#A3F8B2C1]", TICKET_ID)).toBe("Re: Heizung defekt [#A3F8B2C1]");
	});

	it("extrahiert Ticket-Kennungen aus Antwort-Betreffen", () => {
		expect(extractTicketRefsFromSubject("Re: Heizung defekt [#a3f8b2c1]")).toEqual(["a3f8b2c1"]);
		expect(extractTicketRefsFromSubject("AW: [#A3F8B2C1] Heizung defekt")).toEqual(["a3f8b2c1"]);
		expect(extractTicketRefsFromSubject("Kein Tag vorhanden")).toEqual([]);
		// Mehrere Tags (z. B. manuell kombinierte Verläufe) in Reihenfolge.
		expect(extractTicketRefsFromSubject("WG: [#a3f8b2c1] und [#b2c1d4e5]")).toEqual(["a3f8b2c1", "b2c1d4e5"]);
		// Zu kurze/lange oder nicht-hex Inhalte sind keine Kennungen.
		expect(extractTicketRefsFromSubject("[#123] [#a3f8b2c1ff] [#zzzzzzzz]")).toEqual([]);
	});
});
