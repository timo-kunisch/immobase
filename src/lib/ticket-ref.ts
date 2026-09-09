/**
 * Ticket-Kennung im E-Mail-Betreff („Ticket-Referenz").
 *
 * Ausgehende Ticket-E-Mails erhalten automatisch ein Tag im Betreff
 * (z. B. „Re: Heizung defekt [#a3f8b2c1]"). E-Mail-Clients übernehmen den
 * Betreff bei Antworten in der Regel unverändert, sodass der IMAP-Import
 * die Antwort auch dann dem richtigen Ticket zuordnen kann, wenn die
 * Threading-Header (In-Reply-To/References) fehlen oder vom Provider
 * verworfen wurden (Fallback in src/lib/email/imap-sync.ts).
 *
 * Reine Funktionen - die Auflösung der Kennung gegen die Datenbank liegt
 * im Repository (src/data/tickets.ts: findTicketIdByRef).
 */

/** Länge der Ticket-Kennung (erste 8 Hex-Zeichen der UUID). */
const TICKET_REF_LENGTH = 8;

/** Erkennt Ticket-Referenzen im Betreff, z. B. „[#a3f8b2c1]". */
const TICKET_REF_PATTERN = /\[#([0-9a-fA-F]{8})\]/g;

/** Kurz-Kennung eines Tickets, z. B. „#a3f8b2c1". */
export function buildTicketRef(ticketId: string): string {
	return `#${ticketId.replaceAll("-", "").slice(0, TICKET_REF_LENGTH).toLowerCase()}`;
}

/** Betreff-Tag eines Tickets, z. B. „[#a3f8b2c1]". */
export function buildTicketSubjectTag(ticketId: string): string {
	return `[${buildTicketRef(ticketId)}]`;
}

/**
 * Hängt das Ticket-Tag an den Betreff an, sofern es nicht schon enthalten
 * ist (idempotent - der Nutzer kann den Betreff frei bearbeiten).
 */
export function ensureTicketSubjectTag(subject: string, ticketId: string): string {
	const tag = buildTicketSubjectTag(ticketId);
	if (subject.toLowerCase().includes(tag.toLowerCase())) {
		return subject;
	}
	return `${subject} ${tag}`;
}

/**
 * Extrahiert alle Ticket-Kennungen aus einem Betreff (in Reihenfolge des
 * Auftretens, ohne führendes „#", kleingeschrieben), z. B. ["a3f8b2c1"].
 */
export function extractTicketRefsFromSubject(subject: string): string[] {
	const refs: string[] = [];
	for (const match of subject.matchAll(TICKET_REF_PATTERN)) {
		refs.push(match[1].toLowerCase());
	}
	return refs;
}
