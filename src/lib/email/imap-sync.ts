import "server-only";

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

import { getImapSyncState, resetImapSyncState, upsertImapSyncState } from "@/data/imap-sync-state";
import { findLinkedTicketIdByMessageIds, importInboundMessage } from "@/data/ticket-messages";
import { findTicketIdByRef } from "@/data/tickets";
import { now } from "@/data/helpers";
import { extractTicketRefsFromSubject } from "@/lib/ticket-ref";

import { getImapConfig, type ImapConfig } from "./imap";

/**
 * IMAP-Abgleich des Ticket-Postfachs: Holt neue Nachrichten aus dem
 * konfigurierten Ordner (inkrementell über UID > lastUid, Stand in
 * `imap_sync_state`), parst sie (mailparser) und legt sie als INBOUND-
 * Einträge in `ticket_messages` ab. Antworten auf bekannte Ticket-E-Mails
 * werden automatisch dem vorhandenen Ticket-Verlauf zugeordnet - primär
 * über die Threading-Header (In-Reply-To/References), als Fallback über
 * die Ticket-Kennung im Betreff („[#a3f8b2c1]", die ausgehende Ticket-
 * E-Mails automatisch erhalten). Alles andere landet im Postfach.
 *
 * Fehler (Server nicht erreichbar, Zugangsdaten falsch, ...) werden nicht
 * weitergeworfen, sondern im Sync-Status abgelegt (Anzeige im Postfach)
 * und protokolliert - der Abruf darf die App niemals stören.
 */

export interface ImapSyncResult {
	imported: number;
	/** Davon automatisch einem bestehenden Ticket zugeordnet (Threading). */
	linked: number;
	error?: string;
}

/** Sehr große Mail-Texte werden gekürzt, damit die DB nicht aufbläht. */
const MAX_BODY_LENGTH = 200_000;

let syncRunning = false;

/**
 * Führt einen Abgleich durch (manueller Button im Postfach und Scheduler).
 * Parallele Läufe werden abgelehnt (Schutz vor Doppelklicks).
 */
export async function syncImapMailbox(): Promise<ImapSyncResult> {
	const config = getImapConfig();
	if (!config) {
		return { imported: 0, linked: 0, error: "IMAP ist nicht konfiguriert." };
	}
	if (syncRunning) {
		return { imported: 0, linked: 0, error: "Es läuft bereits ein Abruf." };
	}
	syncRunning = true;
	try {
		return await runSync(config);
	} finally {
		syncRunning = false;
	}
}

async function runSync(config: ImapConfig): Promise<ImapSyncResult> {
	const client = createClient(config);
	let imported = 0;
	let linked = 0;
	// Vorbelegung für den Fehlerfall: bisheriger Stand bleibt erhalten.
	let uidValidity = getImapSyncState(config.mailbox)?.uidValidity ?? 0;
	let lastUid = getImapSyncState(config.mailbox)?.lastUid ?? 0;

	try {
		await client.connect();
		const lock = await client.getMailboxLock(config.mailbox);
		try {
			uidValidity = client.mailbox ? Number(client.mailbox.uidValidity ?? 0) : 0;
			let state = getImapSyncState(config.mailbox);
			if (state && state.uidValidity !== uidValidity) {
				// Der Server hat die UIDs neu vergeben -> kompletter Neuabgleich
				// (bereits importierte Nachrichten fängt der Unique-Index ab).
				resetImapSyncState(config.mailbox, uidValidity);
				state = getImapSyncState(config.mailbox);
			}
			lastUid = state?.lastUid ?? 0;
			let maxUid = lastUid;

			for await (const msg of client.fetch(`${lastUid + 1}:*`, { uid: true, source: true }, { uid: true })) {
				if (typeof msg.uid === "number") {
					// Auch bei Parse-Fehlern weiterrücken, damit eine defekte
					// Nachricht nicht bei jedem Abruf erneut geladen wird.
					maxUid = Math.max(maxUid, msg.uid);
				}
				if (!msg.source) continue;
				try {
					const linkedTicketId = await importParsedMessage(config.mailbox, msg.uid ?? 0, msg.source);
					imported += 1;
					if (linkedTicketId) linked += 1;
				} catch (error) {
					console.error(`[imap] Nachricht (UID ${msg.uid}) konnte nicht verarbeitet werden:`, error);
				}
			}
			lastUid = maxUid;
		} finally {
			lock.release();
		}

		upsertImapSyncState({ folder: config.mailbox, uidValidity, lastUid, lastError: null, lastNewCount: imported });
		return { imported, linked };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error("[imap] Abruf fehlgeschlagen:", error);
		upsertImapSyncState({ folder: config.mailbox, uidValidity, lastUid, lastError: message, lastNewCount: null });
		return { imported, linked, error: message };
	} finally {
		try {
			await client.logout();
		} catch {
			// Verbindung war evtl. schon weg - egal.
		}
	}
}

/**
 * Parst eine Roh-Nachricht und legt sie an. Gibt die Ticket-ID zurück,
 * wenn die Nachricht automatisch zugeordnet wurde (Threading-Header oder
 * Ticket-Kennung im Betreff).
 */
async function importParsedMessage(folder: string, uid: number, source: Buffer): Promise<string | null> {
	const parsed = await simpleParser(source);

	// Threading-Verweise normalisieren (references kann String oder Array sein).
	const references = Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [];
	const threadIds = [parsed.inReplyTo, ...references].filter((id): id is string => Boolean(id));
	let linkedTicketId = threadIds.length > 0 ? findLinkedTicketIdByMessageIds(threadIds) : null;
	if (!linkedTicketId && parsed.subject) {
		// Fallback: Ticket-Kennung im Betreff (überlebt Clients, die keine
		// Threading-Header setzen). Mehrdeutige Kennungen liefern bewusst
		// keinen Treffer (findTicketIdByRef) -> solche Mails bleiben im Postfach.
		for (const ref of extractTicketRefsFromSubject(parsed.subject)) {
			linkedTicketId = findTicketIdByRef(ref);
			if (linkedTicketId) break;
		}
	}

	const toAddresses = parsed.to ? (Array.isArray(parsed.to) ? parsed.to.map((addr) => addr.text).join(", ") : parsed.to.text) : null;
	const bodyText = parsed.text ? parsed.text.slice(0, MAX_BODY_LENGTH) : null;

	const { inserted } = importInboundMessage({
		ticketId: linkedTicketId,
		messageId: parsed.messageId ?? null,
		imapFolder: folder,
		imapUid: uid,
		fromAddress: parsed.from?.text ?? null,
		toAddresses,
		subject: parsed.subject ?? null,
		bodyText,
		createdAt: parsed.date ? parsed.date.toISOString() : now(),
	});
	return inserted ? linkedTicketId : null;
}

function createClient(config: ImapConfig): ImapFlow {
	return new ImapFlow({
		host: config.host,
		port: config.port,
		secure: config.secure,
		auth: { user: config.user, pass: config.pass },
		logger: false,
	});
}

/** Verbindungstest aus den Einstellungen (nach dem Speichern). */
export async function testImapConnection(): Promise<{ ok: boolean; error?: string }> {
	const config = getImapConfig();
	if (!config) {
		return { ok: false, error: "IMAP ist nicht vollständig konfiguriert (Server, Benutzername und Passwort sind erforderlich)." };
	}
	const client = createClient(config);
	try {
		await client.connect();
		return { ok: true };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	} finally {
		try {
			await client.logout();
		} catch {
			// Verbindung kam evtl. nie zustande - egal.
		}
	}
}

// ------------------------------------------------------------
// Scheduler (periodischer Abruf, Muster wie Dropbox-Backup)
// ------------------------------------------------------------

/** Prüfintervall des automatischen Abrufs. */
const SCHEDULER_CHECK_INTERVAL_MS = 5 * 60 * 1000;

/** Verzögerung des ersten Abrufs nach dem Server-Start. */
const SCHEDULER_INITIAL_DELAY_MS = 30 * 1000;

let schedulerTimer: NodeJS.Timeout | null = null;

/**
 * Startet den Hintergrund-Abruf des IMAP-Postfachs. Idempotent; Timer sind
 * unref'd. Aufruf aus src/app/(app)/layout.tsx (bei der ersten
 * authentifizierten Seitenanzeige) - NICHT aus src/instrumentation.ts
 * (gleicher Grund wie beim Dropbox-Scheduler: Standalone-Tracing).
 */
export function startImapSyncScheduler(): void {
	if (schedulerTimer) return;
	schedulerTimer = setInterval(() => {
		void maybeRunScheduledImapSync();
	}, SCHEDULER_CHECK_INTERVAL_MS);
	schedulerTimer.unref();
	const initial = setTimeout(() => {
		void maybeRunScheduledImapSync();
	}, SCHEDULER_INITIAL_DELAY_MS);
	initial.unref();
}

/** Ruft ab, wenn IMAP konfiguriert ist; Fehler werden nur protokolliert. */
export async function maybeRunScheduledImapSync(): Promise<void> {
	try {
		if (!getImapConfig()) return;
		await syncImapMailbox();
	} catch (error) {
		console.error("IMAP-Scheduler: Abruf fehlgeschlagen", error);
	}
}
