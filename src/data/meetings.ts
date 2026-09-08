import { getDb } from "./db";
import { newId, now } from "./helpers";
import type {
	Hoa,
	OwnerMeeting,
	OwnerMeetingAgendaItem,
	OwnerMeetingStatus,
	OwnerResolution,
} from "./types";
import { nextResolutionSequenceNumber } from "@/lib/hoa-meetings";

/**
 * Repository für Eigentümerversammlungen, Tagesordnungspunkte und die
 * Beschluss-Sammlung (Tabellen `owner_meetings`,
 * `owner_meeting_agenda_items`, `owner_resolutions`, § 24 Abs. 6 WEG).
 *
 * Enthält zusätzlich die für die WEG-Filter/Anzeige benötigten Lesezugriffe
 * auf die Stammdaten-Tabellen `hoas` und `properties` (per JOIN bzw. eigene
 * Abfrage hier gebündelt, statt über Modulgrenzen verteilt).
 *
 * Konventionen siehe src/data/properties.ts.
 */

// ------------------------------------------------------------
// WEG-Stammdaten (nur Lesezugriff, für HoaFilter/Anzeige)
// ------------------------------------------------------------

const HOA_COLUMNS = `
	id, property_id AS propertyId, name, total_shares AS totalShares,
	bank_iban AS bankIban, bank_bic AS bankBic, notes,
	created_at AS createdAt, updated_at AS updatedAt
`;

/** Alle WEGs alphabetisch (Befüllung des HoaFilter auf den /weg/*-Seiten). */
export function listHoas(): Hoa[] {
	return getDb()
		.prepare(`SELECT ${HOA_COLUMNS} FROM hoas ORDER BY name ASC`)
		.all() as Hoa[];
}

// ------------------------------------------------------------
// Eigentümerversammlungen (owner_meetings)
// ------------------------------------------------------------

const MEETING_COLUMNS = `
	id, hoa_id AS hoaId, title, type, status, meeting_date AS meetingDate, location,
	invitation_sent_at AS invitationSentAt,
	invitation_pdf_path AS invitationPdfPath, invitation_pdf_file_size AS invitationPdfFileSize,
	invitation_pdf_generated_at AS invitationPdfGeneratedAt,
	minutes_text AS minutesText, minutes_finalized_at AS minutesFinalizedAt,
	minutes_pdf_path AS minutesPdfPath, minutes_pdf_file_size AS minutesPdfFileSize,
	minutes_pdf_generated_at AS minutesPdfGeneratedAt,
	notes, created_at AS createdAt, updated_at AS updatedAt
`;

/** Dieselben Spalten mit Tabellen-Präfix für JOIN-Abfragen. */
const MEETING_JOIN_COLUMNS = `
	m.id, m.hoa_id AS hoaId, m.title, m.type, m.status, m.meeting_date AS meetingDate, m.location,
	m.invitation_sent_at AS invitationSentAt,
	m.invitation_pdf_path AS invitationPdfPath, m.invitation_pdf_file_size AS invitationPdfFileSize,
	m.invitation_pdf_generated_at AS invitationPdfGeneratedAt,
	m.minutes_text AS minutesText, m.minutes_finalized_at AS minutesFinalizedAt,
	m.minutes_pdf_path AS minutesPdfPath, m.minutes_pdf_file_size AS minutesPdfFileSize,
	m.minutes_pdf_generated_at AS minutesPdfGeneratedAt,
	m.notes, m.created_at AS createdAt, m.updated_at AS updatedAt
`;

export interface OwnerMeetingInput {
	hoaId: string;
	title: string;
	type: OwnerMeeting["type"];
	status: OwnerMeetingStatus;
	meetingDate: string | null;
	location: string | null;
	notes: string | null;
}

/** Versammlung inklusive Name der zugehörigen WEG (Listenansicht). */
export interface OwnerMeetingWithHoaName extends OwnerMeeting {
	hoaName: string;
}

/**
 * Versammlung inklusive WEG-Name und Liegenschafts-Adresse - wird für die
 * Detailansicht sowie die PDF-Erzeugung (Einladung/Protokoll, Briefkopf mit
 * Empfängeradresse) benötigt.
 */
export interface OwnerMeetingWithHoaAndProperty extends OwnerMeeting {
	hoaName: string;
	propertyName: string;
	propertyStreet: string;
	propertyZipCode: string;
	propertyCity: string;
}

export function listOwnerMeetings(filter?: { hoaId?: string }): OwnerMeetingWithHoaName[] {
	const where = filter?.hoaId ? "WHERE m.hoa_id = ?" : "";
	const params = filter?.hoaId ? [filter.hoaId] : [];
	return getDb()
		.prepare(
			`SELECT ${MEETING_JOIN_COLUMNS}, h.name AS hoaName
			 FROM owner_meetings m
			 JOIN hoas h ON h.id = m.hoa_id
			 ${where}
			 ORDER BY m.created_at DESC`
		)
		.all(...params) as OwnerMeetingWithHoaName[];
}

export function getOwnerMeeting(id: string): OwnerMeeting | null {
	const row = getDb()
		.prepare(`SELECT ${MEETING_COLUMNS} FROM owner_meetings WHERE id = ?`)
		.get(id) as OwnerMeeting | undefined;
	return row ?? null;
}

export function getOwnerMeetingWithHoaAndProperty(id: string): OwnerMeetingWithHoaAndProperty | null {
	const row = getDb()
		.prepare(
			`SELECT ${MEETING_JOIN_COLUMNS},
				h.name AS hoaName,
				p.name AS propertyName, p.street AS propertyStreet,
				p.zip_code AS propertyZipCode, p.city AS propertyCity
			 FROM owner_meetings m
			 JOIN hoas h ON h.id = m.hoa_id
			 JOIN properties p ON p.id = h.property_id
			 WHERE m.id = ?`
		)
		.get(id) as OwnerMeetingWithHoaAndProperty | undefined;
	return row ?? null;
}

export function createOwnerMeeting(input: OwnerMeetingInput): OwnerMeeting {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO owner_meetings (id, hoa_id, title, type, status, meeting_date, location, notes, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(id, input.hoaId, input.title, input.type, input.status, input.meetingDate, input.location, input.notes, timestamp, timestamp);
	return {
		id,
		...input,
		invitationSentAt: null,
		invitationPdfPath: null,
		invitationPdfFileSize: null,
		invitationPdfGeneratedAt: null,
		minutesText: null,
		minutesFinalizedAt: null,
		minutesPdfPath: null,
		minutesPdfFileSize: null,
		minutesPdfGeneratedAt: null,
		createdAt: timestamp,
		updatedAt: timestamp,
	};
}

export function updateOwnerMeeting(id: string, input: OwnerMeetingInput): void {
	getDb()
		.prepare(
			`UPDATE owner_meetings
			 SET hoa_id = ?, title = ?, type = ?, status = ?, meeting_date = ?, location = ?, notes = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(input.hoaId, input.title, input.type, input.status, input.meetingDate, input.location, input.notes, now(), id);
}

export function deleteOwnerMeeting(id: string): void {
	getDb().prepare("DELETE FROM owner_meetings WHERE id = ?").run(id);
}

/** Speichert Pfad/Metadaten der erzeugten Einladungs-PDF und setzt den (ggf. hochgestuften) Status. */
export function setOwnerMeetingInvitationPdf(
	id: string,
	data: { pdfPath: string; pdfFileSize: number; pdfGeneratedAt: string; status: OwnerMeetingStatus }
): void {
	getDb()
		.prepare(
			`UPDATE owner_meetings
			 SET invitation_pdf_path = ?, invitation_pdf_file_size = ?, invitation_pdf_generated_at = ?, status = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(data.pdfPath, data.pdfFileSize, data.pdfGeneratedAt, data.status, now(), id);
}

export function updateOwnerMeetingMinutesText(id: string, minutesText: string | null): void {
	getDb()
		.prepare("UPDATE owner_meetings SET minutes_text = ?, updated_at = ? WHERE id = ?")
		.run(minutesText, now(), id);
}

/**
 * Speichert Pfad/Metadaten der erzeugten Protokoll-PDF, markiert das
 * Protokoll als finalisiert und setzt den Status (MINUTES_FINALIZED).
 */
export function setOwnerMeetingMinutesPdf(
	id: string,
	data: {
		pdfPath: string;
		pdfFileSize: number;
		pdfGeneratedAt: string;
		minutesFinalizedAt: string;
		status: OwnerMeetingStatus;
	}
): void {
	getDb()
		.prepare(
			`UPDATE owner_meetings
			 SET minutes_pdf_path = ?, minutes_pdf_file_size = ?, minutes_pdf_generated_at = ?,
			     minutes_finalized_at = ?, status = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(data.pdfPath, data.pdfFileSize, data.pdfGeneratedAt, data.minutesFinalizedAt, data.status, now(), id);
}

// ------------------------------------------------------------
// Tagesordnungspunkte (owner_meeting_agenda_items)
// ------------------------------------------------------------

const AGENDA_ITEM_COLUMNS = `
	id, meeting_id AS meetingId, position, title, description,
	created_at AS createdAt, updated_at AS updatedAt
`;

export interface AgendaItemInput {
	meetingId: string;
	title: string;
	description: string | null;
	position: number;
}

export function listAgendaItemsForMeeting(meetingId: string): OwnerMeetingAgendaItem[] {
	return getDb()
		.prepare(`SELECT ${AGENDA_ITEM_COLUMNS} FROM owner_meeting_agenda_items WHERE meeting_id = ? ORDER BY position ASC`)
		.all(meetingId) as OwnerMeetingAgendaItem[];
}

export function createAgendaItem(input: AgendaItemInput): OwnerMeetingAgendaItem {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO owner_meeting_agenda_items (id, meeting_id, position, title, description, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.run(id, input.meetingId, input.position, input.title, input.description, timestamp, timestamp);
	return { id, ...input, createdAt: timestamp, updatedAt: timestamp };
}

export function updateAgendaItem(id: string, input: AgendaItemInput): void {
	getDb()
		.prepare(
			`UPDATE owner_meeting_agenda_items
			 SET meeting_id = ?, position = ?, title = ?, description = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(input.meetingId, input.position, input.title, input.description, now(), id);
}

export function deleteAgendaItem(id: string): void {
	getDb().prepare("DELETE FROM owner_meeting_agenda_items WHERE id = ?").run(id);
}

// ------------------------------------------------------------
// Beschluss-Sammlung (owner_resolutions, § 24 Abs. 6 WEG)
// ------------------------------------------------------------

const RESOLUTION_COLUMNS = `
	id, hoa_id AS hoaId, meeting_id AS meetingId, agenda_item_id AS agendaItemId,
	sequence_number AS sequenceNumber, title, content, voting_result AS votingResult,
	votes_for AS votesFor, votes_against AS votesAgainst, votes_abstained AS votesAbstained,
	resolved_at AS resolvedAt, contested_until AS contestedUntil, notes,
	created_at AS createdAt, updated_at AS updatedAt
`;

export interface OwnerResolutionInput {
	hoaId: string;
	meetingId: string;
	agendaItemId: string | null;
	title: string;
	content: string;
	votingResult: OwnerResolution["votingResult"];
	votesFor: number | null;
	votesAgainst: number | null;
	votesAbstained: number | null;
	resolvedAt: string;
	contestedUntil: string | null;
	notes: string | null;
}

/**
 * Beim Bearbeiten bleiben hoaId und die fortlaufende sequenceNumber
 * unverändert (die Beschluss-Sammlung ist unveränderlich in ihrer
 * Nummerierung) - daher ohne beide Felder.
 */
export type OwnerResolutionUpdateInput = Omit<OwnerResolutionInput, "hoaId">;

/** Beschluss inklusive Versammlungs-Titel und WEG-Name (Beschluss-Sammlung). */
export interface OwnerResolutionWithMeetingAndHoa extends OwnerResolution {
	meetingTitle: string;
	hoaName: string;
}

/**
 * SELECT-/JOIN-Fragment der Beschluss-Sammlung (Beschluss + Versammlungs-
 * Titel + WEG-Name) - gemeinsam genutzt von listOwnerResolutions und
 * listOwnerResolutionsPage. Sortierung absteigend nach fortlaufender
 * Nummer (pro WEG eindeutig, damit deterministisch paginierbar).
 */
const RESOLUTION_COLLECTION_SELECT = `
	SELECT r.id, r.hoa_id AS hoaId, r.meeting_id AS meetingId, r.agenda_item_id AS agendaItemId,
		r.sequence_number AS sequenceNumber, r.title, r.content, r.voting_result AS votingResult,
		r.votes_for AS votesFor, r.votes_against AS votesAgainst, r.votes_abstained AS votesAbstained,
		r.resolved_at AS resolvedAt, r.contested_until AS contestedUntil, r.notes,
		r.created_at AS createdAt, r.updated_at AS updatedAt,
		m.title AS meetingTitle, h.name AS hoaName
	FROM owner_resolutions r
	JOIN owner_meetings m ON m.id = r.meeting_id
	JOIN hoas h ON h.id = r.hoa_id
`;

/**
 * Vollständige Beschluss-Sammlung einer WEG (oder aller WEGs), absteigend
 * nach fortlaufender Nummer sortiert.
 */
export function listOwnerResolutions(filter?: { hoaId?: string }): OwnerResolutionWithMeetingAndHoa[] {
	const where = filter?.hoaId ? "WHERE r.hoa_id = ?" : "";
	const params = filter?.hoaId ? [filter.hoaId] : [];
	return getDb()
		.prepare(`${RESOLUTION_COLLECTION_SELECT} ${where} ORDER BY r.sequence_number DESC`)
		.all(...params) as OwnerResolutionWithMeetingAndHoa[];
}

/** Zählt Beschlüsse der Sammlung (gleicher Filter wie listOwnerResolutions) - Grundlage der Seitennummerierung. */
export function countOwnerResolutions(filter?: { hoaId?: string }): number {
	const where = filter?.hoaId ? "WHERE r.hoa_id = ?" : "";
	const params = filter?.hoaId ? [filter.hoaId] : [];
	const row = getDb().prepare(`SELECT COUNT(*) AS value FROM owner_resolutions r ${where}`).get(...params) as { value: number };
	return row.value;
}

/**
 * Seitenweise Variante von listOwnerResolutions (LIMIT/OFFSET) für die
 * paginierte Beschluss-Sammlung (/weg/beschluesse). Achtung: Über WEGs
 * hinweg ist sequence_number nur pro WEG eindeutig - die ID dient daher
 * als Tie-Breaker. `limit`/`offset` kommen aus resolvePagination
 * (src/lib/pagination.ts).
 */
export function listOwnerResolutionsPage(filter: { hoaId?: string } | undefined, page: { limit: number; offset: number }): OwnerResolutionWithMeetingAndHoa[] {
	const where = filter?.hoaId ? "WHERE r.hoa_id = ?" : "";
	const params = filter?.hoaId ? [filter.hoaId] : [];
	return getDb()
		.prepare(`${RESOLUTION_COLLECTION_SELECT} ${where} ORDER BY r.sequence_number DESC, r.id DESC LIMIT ? OFFSET ?`)
		.all(...params, page.limit, page.offset) as OwnerResolutionWithMeetingAndHoa[];
}

export function listResolutionsForMeeting(meetingId: string): OwnerResolution[] {
	return getDb()
		.prepare(`SELECT ${RESOLUTION_COLUMNS} FROM owner_resolutions WHERE meeting_id = ? ORDER BY sequence_number ASC`)
		.all(meetingId) as OwnerResolution[];
}

export function getOwnerResolution(id: string): OwnerResolution | null {
	const row = getDb()
		.prepare(`SELECT ${RESOLUTION_COLUMNS} FROM owner_resolutions WHERE id = ?`)
		.get(id) as OwnerResolution | undefined;
	return row ?? null;
}

/** Alle bisher vergebenen Beschlussnummern einer WEG (für MAX+1-Logik und Lösch-Prüfung). */
export function listResolutionSequenceNumbersForHoa(hoaId: string): number[] {
	const rows = getDb()
		.prepare("SELECT sequence_number AS sequenceNumber FROM owner_resolutions WHERE hoa_id = ?")
		.all(hoaId) as { sequenceNumber: number }[];
	return rows.map((row) => row.sequenceNumber);
}

/** Anzahl der Beschlüsse einer Versammlung (Lösch-Sperre für Versammlungen mit Beschlüssen). */
export function countResolutionsForMeeting(meetingId: string): number {
	const row = getDb()
		.prepare("SELECT COUNT(*) AS value FROM owner_resolutions WHERE meeting_id = ?")
		.get(meetingId) as { value: number };
	return row.value;
}

/**
 * Legt einen Beschluss mit der nächsten fortlaufenden Nummer der WEG an.
 *
 * Vergabe der nächsten Nummer (MAX+1) und Insert laufen in EINER
 * better-sqlite3-Transaktion - so ist die Nummernvergabe atomar und die
 * theoretische Race Condition bei zwei gleichzeitigen Inserts
 * ausgeschlossen. Der unique index (hoa_id, sequence_number) bleibt
 * zusätzliche Absicherung.
 */
export function createResolution(input: OwnerResolutionInput): OwnerResolution {
	const db = getDb();
	const id = newId();
	const timestamp = now();

	const insertWithNextSequenceNumber = db.transaction(() => {
		const rows = db
			.prepare("SELECT sequence_number AS sequenceNumber FROM owner_resolutions WHERE hoa_id = ?")
			.all(input.hoaId) as { sequenceNumber: number }[];
		const sequenceNumber = nextResolutionSequenceNumber(rows.map((row) => row.sequenceNumber));
		db.prepare(
			`INSERT INTO owner_resolutions
			 (id, hoa_id, meeting_id, agenda_item_id, sequence_number, title, content, voting_result,
			  votes_for, votes_against, votes_abstained, resolved_at, contested_until, notes, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		).run(
			id,
			input.hoaId,
			input.meetingId,
			input.agendaItemId,
			sequenceNumber,
			input.title,
			input.content,
			input.votingResult,
			input.votesFor,
			input.votesAgainst,
			input.votesAbstained,
			input.resolvedAt,
			input.contestedUntil,
			input.notes,
			timestamp,
			timestamp
		);
		return sequenceNumber;
	});

	const sequenceNumber = insertWithNextSequenceNumber();
	return { id, ...input, sequenceNumber, createdAt: timestamp, updatedAt: timestamp };
}

export function updateResolution(id: string, input: OwnerResolutionUpdateInput): void {
	getDb()
		.prepare(
			`UPDATE owner_resolutions
			 SET meeting_id = ?, agenda_item_id = ?, title = ?, content = ?, voting_result = ?,
			     votes_for = ?, votes_against = ?, votes_abstained = ?,
			     resolved_at = ?, contested_until = ?, notes = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(
			input.meetingId,
			input.agendaItemId,
			input.title,
			input.content,
			input.votingResult,
			input.votesFor,
			input.votesAgainst,
			input.votesAbstained,
			input.resolvedAt,
			input.contestedUntil,
			input.notes,
			now(),
			id
		);
}

export function deleteResolution(id: string): void {
	getDb().prepare("DELETE FROM owner_resolutions WHERE id = ?").run(id);
}
