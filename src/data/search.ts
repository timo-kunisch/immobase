import { getDb } from "./db";
import { formatCurrency, formatDate } from "@/lib/format";
import { MIN_SEARCH_QUERY_LENGTH, type SearchRow } from "@/lib/search-types";
import { userDisplayName } from "@/lib/user-name";

/**
 * Repository für die GLOBALE SUCHE (Command-Palette, Cmd/Ctrl+K): durchsucht
 * sämtliche Fachdaten beider Bereiche (Mietverwaltung + WEG) in einer einzigen
 * Abfrage-artigen Funktion. Die Aufrufer:
 * - API-Route src/app/api/search/route.ts (autoritative Auth-Prüfung),
 * - Eigene Tests (src/data/search.test.ts).
 *
 * Architektur-Entscheidung (bewusst, siehe auch src/lib/documents-overview.ts):
 * Statt SQL-LIKE-Filtern werden je Entität die minimalen Anzeigespalten
 * geladen und in JS über einen lowercase-Heuhaufen gefiltert. Grund: SQLites
 * LIKE/lower() falten NUR ASCII - „münchen“ würde „München“ NICHT finden.
 * Für eine deutsche Fachanwendung ist Unicode-Faltung (JS toLowerCase)
 * wichtiger als die theoretisch mögliche Menge-Skalierung; die Datenmengen
 * einer Desktop-Liegenheitsverwaltung sind dafür zu klein. Einzige Ausnahme:
 * Der OCR-Volltext der DMS-Dokumente wird per SQL LIKE abgefragt (kann
 * kilobyte- bis megabytegroß sein und wird nicht in JS geladen); dort gilt
 * die ASCII-Einschränkung bewusst in Kauf genommen (Namen/Dateinamen laufen
 * weiterhin über den JS-Pfad mit vollständiger Faltung).
 *
 * Append-lastige Tabellen (Transaktionen, Tickets, Dokumente, …) werden auf
 * die jüngsten SCAN_LIMIT Zeilen begrenzt - ältere Treffer wären ohnehin kaum
 * noch fachlich relevant, und so bleibt die Suche bei großen Beständen
 * schnell. Stammdaten/Pläne (realistisch klein) werden vollständig gescannt.
 */

export interface SearchDatabaseOptions {
	/**
	 * Maximale Treffer je Entitätsart (Default 5). Die globale Suche zeigt
	 * die besten Treffer je Kategorie, keine vollständige Liste.
	 */
	limitPerType?: number;
	/**
	 * Benutzerkonten durchsuchen (E-Mail-Adressen). NUR für Admins setzen -
	 * die API-Route entscheidet das anhand der Session-Rolle.
	 */
	includeUsers?: boolean;
}

const DEFAULT_LIMIT_PER_TYPE = 5;

/**
 * Obergrenze für den Scan append-lastiger Tabellen (jüngste Einträge via
 * ORDER BY ... DESC LIMIT). Bewusst großzügig: deckt mehrere Jahre Betrieb
 * ab, ohne bei jedem Tastendruck die komplette Historie zu laden.
 */
const SCAN_LIMIT = 2000;

/** Heuhaufen für die JS-Filterung: alle Teile lowercase aneinanderhängen. */
function hay(...parts: Array<string | null | undefined>): string {
	return parts
		.filter((part): part is string => typeof part === "string" && part.length > 0)
		.join(" ")
		.toLowerCase();
}

/**
 * Filtert eine Ergebnismenge gegen die Suchanfrage und kürzt auf das Limit.
 * `build` liefert je Zeile Heuhaufen + Ergebnis (oder null zum Überspringen).
 */
function collectMatches<T>(
	needle: string,
	rows: T[],
	limit: number,
	build: (row: T) => { haystack: string; result: SearchRow } | null,
): SearchRow[] {
	const matches: SearchRow[] = [];
	for (const row of rows) {
		const mapped = build(row);
		if (!mapped) continue;
		if (needle && !mapped.haystack.includes(needle)) continue;
		matches.push(mapped.result);
		if (matches.length >= limit) break;
	}
	return matches;
}

/** Untertitel aus vorhandenen Teilen („ · “-getrennt) bauen. */
function subtitleOf(...parts: Array<string | null | undefined>): string | null {
	const subtitle = parts
		.filter((part): part is string => typeof part === "string" && part.length > 0)
		.join(" · ");
	return subtitle.length > 0 ? subtitle : null;
}

export function searchDatabase(query: string, options: SearchDatabaseOptions = {}): SearchRow[] {
	const trimmed = query.trim().toLowerCase();
	if (trimmed.length < MIN_SEARCH_QUERY_LENGTH) return [];
	const limit = options.limitPerType ?? DEFAULT_LIMIT_PER_TYPE;
	const results: SearchRow[] = [];
	const add = (rows: SearchRow[]) => results.push(...rows);

	// --- Liegenschaften ------------------------------------------------------
	const propertyRows = getDb()
		.prepare(`SELECT id, name, street, zip_code AS zipCode, city, notes FROM properties ORDER BY name`)
		.all() as Array<{ id: string; name: string; street: string; zipCode: string; city: string; notes: string | null }>;
	add(
		collectMatches(trimmed, propertyRows, limit, (row) => ({
			haystack: hay(row.name, row.street, row.zipCode, row.city, row.notes),
			result: {
				type: "property",
				id: row.id,
				title: row.name,
				subtitle: subtitleOf(row.street, [row.zipCode, row.city].filter(Boolean).join(" ")),
				href: `/liegenschaften#property-${row.id}`,
			},
		})),
	);

	// --- Einheiten (mit Liegenschaft als Kontext) -----------------------------
	const unitRows = getDb()
		.prepare(
			`SELECT u.id, u.label, u.floor, p.name AS propertyName, p.city AS propertyCity
			 FROM units u JOIN properties p ON p.id = u.property_id
			 ORDER BY u.label`
		)
		.all() as Array<{ id: string; label: string; floor: string | null; propertyName: string; propertyCity: string }>;
	add(
		collectMatches(trimmed, unitRows, limit, (row) => ({
			haystack: hay(row.label, row.floor, row.propertyName, row.propertyCity),
			result: {
				type: "unit",
				id: row.id,
				title: row.label,
				subtitle: subtitleOf(row.propertyName, row.floor),
				href: `/einheiten#unit-${row.id}`,
			},
		})),
	);

	// --- Mieter ---------------------------------------------------------------
	const tenantRows = getDb()
		.prepare(
			`SELECT id, first_name AS firstName, last_name AS lastName,
			        street, zip_code AS zipCode, city, country, email, phone, notes
			 FROM tenants ORDER BY last_name, first_name`
		)
		.all() as Array<{
		id: string;
		firstName: string;
		lastName: string;
		street: string | null;
		zipCode: string | null;
		city: string | null;
		country: string | null;
		email: string | null;
		phone: string | null;
		notes: string | null;
	}>;
	add(
		collectMatches(trimmed, tenantRows, limit, (row) => ({
			haystack: hay(row.firstName, row.lastName, row.street, row.zipCode, row.city, row.country, row.email, row.phone, row.notes),
			result: {
				type: "tenant",
				id: row.id,
				title: `${row.firstName} ${row.lastName}`,
				subtitle: subtitleOf(row.email, row.phone),
				href: `/mieter#tenant-${row.id}`,
			},
		})),
	);

	// --- Mietverträge (suchbar über Mieter-, Einheits- und Liegenschaftsnamen) -
	const leaseRows = getDb()
		.prepare(
			`SELECT l.id, l.start_date AS startDate, l.end_date AS endDate, l.notes,
			        u.label AS unitLabel, p.name AS propertyName,
			        t.first_name AS tenantFirstName, t.last_name AS tenantLastName
			 FROM leases l
			 JOIN units u ON u.id = l.unit_id
			 JOIN properties p ON p.id = u.property_id
			 JOIN tenants t ON t.id = l.tenant_id
			 ORDER BY l.start_date DESC`
		)
		.all() as Array<{
		id: string;
		startDate: string;
		endDate: string | null;
		notes: string | null;
		unitLabel: string;
		propertyName: string;
		tenantFirstName: string;
		tenantLastName: string;
	}>;
	add(
		collectMatches(trimmed, leaseRows, limit, (row) => ({
			haystack: hay(row.unitLabel, row.propertyName, row.tenantFirstName, row.tenantLastName, row.startDate, row.endDate, row.notes),
			result: {
				type: "lease",
				id: row.id,
				title: row.unitLabel,
				subtitle: subtitleOf(`${row.tenantFirstName} ${row.tenantLastName}`, row.propertyName, formatDate(row.startDate)),
				href: `/vertraege#lease-${row.id}`,
			},
		})),
	);

	// --- Tickets --------------------------------------------------------------
	const ticketRows = getDb()
		.prepare(
			`SELECT t.id, t.title, t.status, t.created_at AS createdAt,
			        p.name AS propertyName, u.label AS unitLabel
			 FROM tickets t
			 LEFT JOIN properties p ON p.id = t.property_id
			 LEFT JOIN units u ON u.id = t.unit_id
			 ORDER BY t.created_at DESC
			 LIMIT ${SCAN_LIMIT}`
		)
		.all() as Array<{
		id: string;
		title: string;
		status: string;
		createdAt: string;
		propertyName: string | null;
		unitLabel: string | null;
	}>;
	add(
		collectMatches(trimmed, ticketRows, limit, (row) => ({
			haystack: hay(row.title, row.propertyName, row.unitLabel, row.status),
			result: {
				type: "ticket",
				id: row.id,
				title: row.title,
				subtitle: subtitleOf(row.propertyName, row.unitLabel),
				href: `/tickets/${row.id}`,
			},
		})),
	);

	// --- Dokumente: DMS-Uploads + generierte Schreiben (eine Ergebnisart) ------
	// Uploads: Name/Kontext per JS-Filter; OCR-Volltext zusätzlich per SQL LIKE
	// (siehe Dateikopf-Kommentar zur bewussten ASCII-Einschränkung dort).
	const documentRows = getDb()
		.prepare(
			`SELECT d.id, d.file_name AS fileName,
			        p.name AS propertyName, u.label AS unitLabel,
			        t.first_name AS tenantFirstName, t.last_name AS tenantLastName
			 FROM documents d
			 LEFT JOIN properties p ON p.id = d.property_id
			 LEFT JOIN units u ON u.id = d.unit_id
			 LEFT JOIN tenants t ON t.id = d.tenant_id
			 WHERE d.deleted_at IS NULL
			 ORDER BY d.created_at DESC
			 LIMIT ${SCAN_LIMIT}`
		)
		.all() as Array<{
		id: string;
		fileName: string;
		propertyName: string | null;
		unitLabel: string | null;
		tenantFirstName: string | null;
		tenantLastName: string | null;
	}>;
	const documentMatches = collectMatches(trimmed, documentRows, limit, (row) => ({
		haystack: hay(row.fileName, row.propertyName, row.unitLabel, row.tenantFirstName, row.tenantLastName),
		result: {
			type: "document",
			id: row.id,
			title: row.fileName,
			subtitle: subtitleOf(row.propertyName, row.unitLabel, row.tenantFirstName ? `${row.tenantFirstName} ${row.tenantLastName}` : null),
			href: `/dokumente?q=${encodeURIComponent(row.fileName)}`,
		},
	}));
	const matchedDocumentIds = new Set(documentMatches.map((row) => row.id));
	const ocrRows = getDb()
		.prepare(
			`SELECT d.id, d.file_name AS fileName,
			        p.name AS propertyName, u.label AS unitLabel,
			        t.first_name AS tenantFirstName, t.last_name AS tenantLastName
			 FROM documents d
			 LEFT JOIN properties p ON p.id = d.property_id
			 LEFT JOIN units u ON u.id = d.unit_id
			 LEFT JOIN tenants t ON t.id = d.tenant_id
			 WHERE d.deleted_at IS NULL AND d.ocr_text LIKE ?
			 ORDER BY d.created_at DESC`
		)
		.all(`%${trimmed}%`) as Array<{
		id: string;
		fileName: string;
		propertyName: string | null;
		unitLabel: string | null;
		tenantFirstName: string | null;
		tenantLastName: string | null;
	}>;
	for (const row of ocrRows) {
		if (documentMatches.length >= limit) break;
		if (matchedDocumentIds.has(row.id)) continue;
		matchedDocumentIds.add(row.id);
		documentMatches.push({
			type: "document",
			id: row.id,
			title: row.fileName,
			subtitle: subtitleOf(row.propertyName, row.unitLabel, row.tenantFirstName ? `${row.tenantFirstName} ${row.tenantLastName}` : null),
			href: `/dokumente?q=${encodeURIComponent(row.fileName)}`,
		});
	}
	add(documentMatches);

	// Generierte Vorlagen-Schreiben (z. B. Mahnungen): wie Uploads behandeln.
	const generatedRows = getDb()
		.prepare(
			`SELECT g.id, g.subject, g.template_title AS templateTitle,
			        t.first_name AS tenantFirstName, t.last_name AS tenantLastName,
			        p.name AS propertyName, u.label AS unitLabel
			 FROM generated_documents g
			 LEFT JOIN tenants t ON t.id = g.tenant_id
			 LEFT JOIN leases l ON l.id = g.lease_id
			 LEFT JOIN units u ON u.id = l.unit_id
			 LEFT JOIN properties p ON p.id = u.property_id
			 WHERE g.deleted_at IS NULL
			 ORDER BY g.created_at DESC
			 LIMIT ${SCAN_LIMIT}`
		)
		.all() as Array<{
		id: string;
		subject: string | null;
		templateTitle: string;
		tenantFirstName: string | null;
		tenantLastName: string | null;
		propertyName: string | null;
		unitLabel: string | null;
	}>;
	add(
		collectMatches(trimmed, generatedRows, limit, (row) => {
			const title = row.subject || row.templateTitle;
			return {
				haystack: hay(title, row.templateTitle, row.tenantFirstName, row.tenantLastName, row.propertyName, row.unitLabel),
				result: {
					type: "document",
					id: row.id,
					title,
					subtitle: subtitleOf(row.tenantFirstName ? `${row.tenantFirstName} ${row.tenantLastName}` : null, row.propertyName),
					href: `/dokumente?q=${encodeURIComponent(title)}`,
				},
			};
		}),
	);

	// --- Eigentümer (WEG) ------------------------------------------------------
	const ownerRows = getDb()
		.prepare(
			`SELECT id, first_name AS firstName, last_name AS lastName, company_name AS companyName,
			        city, email, phone, notes
			 FROM owners ORDER BY last_name, first_name`
		)
		.all() as Array<{
		id: string;
		firstName: string;
		lastName: string;
		companyName: string | null;
		city: string;
		email: string | null;
		phone: string | null;
		notes: string | null;
	}>;
	add(
		collectMatches(trimmed, ownerRows, limit, (row) => ({
			haystack: hay(row.firstName, row.lastName, row.companyName, row.city, row.email, row.phone, row.notes),
			result: {
				type: "owner",
				id: row.id,
				title: row.companyName || `${row.firstName} ${row.lastName}`,
				subtitle: subtitleOf(row.companyName ? `${row.firstName} ${row.lastName}` : null, row.city, row.email),
				href: `/weg/eigentuemer#owner-${row.id}`,
			},
		})),
	);

	// --- WEGs ------------------------------------------------------------------
	const hoaRows = getDb()
		.prepare(
			`SELECT h.id, h.name, h.bank_iban AS bankIban, h.notes,
			        p.name AS propertyName, p.city AS propertyCity
			 FROM hoas h JOIN properties p ON p.id = h.property_id
			 ORDER BY h.name`
		)
		.all() as Array<{ id: string; name: string; bankIban: string | null; notes: string | null; propertyName: string; propertyCity: string }>;
	add(
		collectMatches(trimmed, hoaRows, limit, (row) => ({
			haystack: hay(row.name, row.bankIban, row.propertyName, row.propertyCity, row.notes),
			result: {
				type: "hoa",
				id: row.id,
				title: row.name,
				subtitle: subtitleOf(row.propertyName, row.propertyCity),
				href: `/weg#hoa-${row.id}`,
			},
		})),
	);

	// --- Nebenkosten-Abrechnungsperioden (Mietverwaltung) ----------------------
	const billingRows = getDb()
		.prepare(
			`SELECT b.id, b.period_from AS periodFrom, b.period_to AS periodTo, b.notes, p.name AS propertyName
			 FROM billing_periods b JOIN properties p ON p.id = b.property_id
			 ORDER BY b.period_from DESC`
		)
		.all() as Array<{ id: string; periodFrom: string; periodTo: string; notes: string | null; propertyName: string }>;
	add(
		collectMatches(trimmed, billingRows, limit, (row) => ({
			haystack: hay(row.propertyName, row.periodFrom, row.periodTo, row.notes),
			result: {
				type: "billingPeriod",
				id: row.id,
				title: `${formatDate(row.periodFrom)} – ${formatDate(row.periodTo)}`,
				subtitle: row.propertyName,
				href: `/abrechnung/${row.id}`,
			},
		})),
	);

	// --- Wirtschaftspläne (WEG) -----------------------------------------------
	const economicPlanRows = getDb()
		.prepare(
			`SELECT e.id, e.fiscal_year_from AS fiscalYearFrom, e.fiscal_year_to AS fiscalYearTo, e.notes,
			        h.name AS hoaName
			 FROM economic_plans e JOIN hoas h ON h.id = e.hoa_id
			 ORDER BY e.fiscal_year_from DESC`
		)
		.all() as Array<{ id: string; fiscalYearFrom: string; fiscalYearTo: string; notes: string | null; hoaName: string }>;
	add(
		collectMatches(trimmed, economicPlanRows, limit, (row) => ({
			haystack: hay(row.hoaName, row.fiscalYearFrom, row.fiscalYearTo, row.notes),
			result: {
				type: "economicPlan",
				id: row.id,
				title: `${formatDate(row.fiscalYearFrom)} – ${formatDate(row.fiscalYearTo)}`,
				subtitle: row.hoaName,
				href: `/weg/wirtschaftsplan/${row.id}`,
			},
		})),
	);

	// --- Jahresabrechnungen (WEG) ----------------------------------------------
	const annualStatementRows = getDb()
		.prepare(
			`SELECT a.id, a.period_from AS periodFrom, a.period_to AS periodTo, a.notes, h.name AS hoaName
			 FROM annual_statements a JOIN hoas h ON h.id = a.hoa_id
			 ORDER BY a.period_from DESC`
		)
		.all() as Array<{ id: string; periodFrom: string; periodTo: string; notes: string | null; hoaName: string }>;
	add(
		collectMatches(trimmed, annualStatementRows, limit, (row) => ({
			haystack: hay(row.hoaName, row.periodFrom, row.periodTo, row.notes),
			result: {
				type: "annualStatement",
				id: row.id,
				title: `${formatDate(row.periodFrom)} – ${formatDate(row.periodTo)}`,
				subtitle: row.hoaName,
				href: `/weg/jahresabrechnung/${row.id}`,
			},
		})),
	);

	// --- Eigentümerversammlungen (WEG) ------------------------------------------
	const meetingRows = getDb()
		.prepare(
			`SELECT m.id, m.title, m.type, m.meeting_date AS meetingDate, m.location, m.notes, h.name AS hoaName
			 FROM owner_meetings m JOIN hoas h ON h.id = m.hoa_id
			 ORDER BY m.meeting_date DESC`
		)
		.all() as Array<{
		id: string;
		title: string;
		type: string;
		meetingDate: string | null;
		location: string | null;
		notes: string | null;
		hoaName: string;
	}>;
	add(
		collectMatches(trimmed, meetingRows, limit, (row) => ({
			haystack: hay(row.title, row.location, row.notes, row.hoaName, row.meetingDate, row.type),
			result: {
				type: "meeting",
				id: row.id,
				title: row.title,
				subtitle: subtitleOf(row.hoaName, row.meetingDate ? formatDate(row.meetingDate) : null),
				href: `/weg/versammlungen/${row.id}`,
			},
		})),
	);

	// --- Beschlüsse (WEG) --------------------------------------------------------
	const resolutionRows = getDb()
		.prepare(
			`SELECT r.id, r.sequence_number AS sequenceNumber, r.title, r.content, r.resolved_at AS resolvedAt, r.notes,
			        h.id AS hoaId, h.name AS hoaName
			 FROM owner_resolutions r JOIN hoas h ON h.id = r.hoa_id
			 ORDER BY r.resolved_at DESC
			 LIMIT ${SCAN_LIMIT}`
		)
		.all() as Array<{
		id: string;
		sequenceNumber: number;
		title: string;
		content: string;
		resolvedAt: string;
		notes: string | null;
		hoaId: string;
		hoaName: string;
	}>;
	add(
		collectMatches(trimmed, resolutionRows, limit, (row) => ({
			haystack: hay(row.title, row.content, row.notes, row.hoaName, row.resolvedAt),
			result: {
				type: "resolution",
				id: row.id,
				title: row.title,
				// Der Anker der Beschluss-Sammlung gilt der fortlaufenden Nummer
				// (nicht der Datensatz-ID); ?hoaId filtert die Liste vor.
				subtitle: subtitleOf(`Nr. ${row.sequenceNumber}`, row.hoaName),
				href: `/weg/beschluesse?hoaId=${row.hoaId}#resolution-collection-${row.sequenceNumber}`,
			},
		})),
	);

	// --- Wissensdatenbank ----------------------------------------------------------
	const knowledgeRows = getDb()
		.prepare(`SELECT id, title, category, content FROM knowledge_base_articles ORDER BY title`)
		.all() as Array<{ id: string; title: string; category: string | null; content: string }>;
	add(
		collectMatches(trimmed, knowledgeRows, limit, (row) => ({
			haystack: hay(row.title, row.category, row.content),
			result: {
				type: "knowledgeArticle",
				id: row.id,
				title: row.title,
				subtitle: row.category,
				href: `/wissen/${row.id}`,
			},
		})),
	);

	// --- Dokumentvorlagen -----------------------------------------------------------
	const templateRows = getDb()
		.prepare(`SELECT id, title, category, subject, body FROM document_templates ORDER BY title`)
		.all() as Array<{ id: string; title: string; category: string; subject: string | null; body: string }>;
	add(
		collectMatches(trimmed, templateRows, limit, (row) => ({
			haystack: hay(row.title, row.subject, row.body, row.category),
			result: {
				type: "template",
				id: row.id,
				title: row.title,
				subtitle: row.subject,
				href: `/vorlagen/${row.id}`,
			},
		})),
	);

	// --- Kalenderereignisse (nur manuelle; automatische Termine sind abgeleitet) ---
	const calendarRows = getDb()
		.prepare(`SELECT id, title, description, start_date AS startDate FROM calendar_events ORDER BY start_date`)
		.all() as Array<{ id: string; title: string; description: string | null; startDate: string }>;
	add(
		collectMatches(trimmed, calendarRows, limit, (row) => ({
			haystack: hay(row.title, row.description, row.startDate),
			result: {
				type: "calendarEvent",
				id: row.id,
				title: row.title,
				subtitle: formatDate(row.startDate),
				// Auf den Monat des Ereignisses springen (?month=YYYY-MM).
				href: `/kalender?month=${row.startDate.slice(0, 7)}`,
			},
		})),
	);

	// --- Buchhaltungskonten -----------------------------------------------------------
	const accountRows = getDb()
		.prepare(
			`SELECT a.id, a.label, a.notes, a.property_id AS propertyId, p.name AS propertyName
			 FROM accounts a JOIN properties p ON p.id = a.property_id
			 ORDER BY a.label`
		)
		.all() as Array<{ id: string; label: string; notes: string | null; propertyId: string; propertyName: string }>;
	add(
		collectMatches(trimmed, accountRows, limit, (row) => ({
			haystack: hay(row.label, row.notes, row.propertyName),
			result: {
				type: "account",
				id: row.id,
				title: row.label,
				subtitle: row.propertyName,
				href: `/buchhaltung?propertyId=${row.propertyId}`,
			},
		})),
	);

	// --- Banktransaktionen (Buchhaltung) -----------------------------------------------
	const bankTransactionRows = getDb()
		.prepare(
			`SELECT b.id, b.description, b.partner, b.notes, b.amount, b.booking_date AS bookingDate,
			        b.property_id AS propertyId, p.name AS propertyName
			 FROM bank_transactions b JOIN properties p ON p.id = b.property_id
			 ORDER BY b.booking_date DESC
			 LIMIT ${SCAN_LIMIT}`
		)
		.all() as Array<{
		id: string;
		description: string;
		partner: string | null;
		notes: string | null;
		amount: string;
		bookingDate: string;
		propertyId: string;
		propertyName: string;
	}>;
	add(
		collectMatches(trimmed, bankTransactionRows, limit, (row) => ({
			haystack: hay(row.description, row.partner, row.notes, row.propertyName, row.bookingDate, row.amount),
			result: {
				type: "bankTransaction",
				id: row.id,
				title: row.description,
				subtitle: subtitleOf(row.propertyName, formatCurrency(row.amount), formatDate(row.bookingDate)),
				href: `/buchhaltung?propertyId=${row.propertyId}`,
			},
		})),
	);

	// --- Mietforderungen / Mieteingänge (Finanzen) --------------------------------------
	const transactionRows = getDb()
		.prepare(
			`SELECT t.id, t.purpose, t.amount, t.due_date AS dueDate, t.status, l.id AS leaseId,
			        tn.first_name AS tenantFirstName, tn.last_name AS tenantLastName, u.label AS unitLabel
			 FROM transactions t
			 JOIN leases l ON l.id = t.lease_id
			 JOIN tenants tn ON tn.id = l.tenant_id
			 JOIN units u ON u.id = l.unit_id
			 ORDER BY t.due_date DESC
			 LIMIT ${SCAN_LIMIT}`
		)
		.all() as Array<{
		id: string;
		purpose: string | null;
		amount: string;
		dueDate: string;
		status: string;
		leaseId: string;
		tenantFirstName: string;
		tenantLastName: string;
		unitLabel: string;
	}>;
	add(
		collectMatches(trimmed, transactionRows, limit, (row) => ({
			haystack: hay(row.purpose, row.tenantFirstName, row.tenantLastName, row.unitLabel, row.dueDate, row.amount, row.status),
			result: {
				type: "transaction",
				id: row.id,
				title: row.purpose || formatDate(row.dueDate),
				subtitle: subtitleOf(`${row.tenantFirstName} ${row.tenantLastName}`, row.unitLabel, formatCurrency(row.amount)),
				href: `/finanzen?leaseId=${row.leaseId}`,
			},
		})),
	);

	// --- Hausgelder (WEG) ------------------------------------------------------------------
	const housingChargeRows = getDb()
		.prepare(
			`SELECT h.id, h.purpose, h.amount, h.due_date AS dueDate, h.status,
			        o.first_name AS ownerFirstName, o.last_name AS ownerLastName,
			        u.label AS unitLabel, ho.id AS hoaId, ho.name AS hoaName
			 FROM housing_charges h
			 JOIN units u ON u.id = h.unit_id
			 JOIN owners o ON o.id = h.owner_id
			 JOIN properties p ON p.id = u.property_id
			 JOIN hoas ho ON ho.property_id = p.id
			 ORDER BY h.due_date DESC
			 LIMIT ${SCAN_LIMIT}`
		)
		.all() as Array<{
		id: string;
		purpose: string | null;
		amount: string;
		dueDate: string;
		status: string;
		ownerFirstName: string;
		ownerLastName: string;
		unitLabel: string;
		hoaId: string;
		hoaName: string;
	}>;
	add(
		collectMatches(trimmed, housingChargeRows, limit, (row) => ({
			haystack: hay(row.purpose, row.ownerFirstName, row.ownerLastName, row.unitLabel, row.hoaName, row.dueDate, row.amount, row.status),
			result: {
				type: "housingCharge",
				id: row.id,
				title: row.purpose || formatDate(row.dueDate),
				subtitle: subtitleOf(`${row.ownerFirstName} ${row.ownerLastName}`, row.unitLabel, row.hoaName),
				href: `/weg/hausgeld?hoaId=${row.hoaId}`,
			},
		})),
	);

	// --- Frei definierbare Umlageschlüssel (Mietverwaltung) ----------------------------------
	const allocationKeyRows = getDb()
		.prepare(
			`SELECT c.id, c.label, c.notes, c.property_id AS propertyId, p.name AS propertyName
			 FROM custom_allocation_keys c JOIN properties p ON p.id = c.property_id
			 ORDER BY c.label`
		)
		.all() as Array<{ id: string; label: string; notes: string | null; propertyId: string; propertyName: string }>;
	add(
		collectMatches(trimmed, allocationKeyRows, limit, (row) => ({
			haystack: hay(row.label, row.notes, row.propertyName),
			result: {
				type: "allocationKey",
				id: row.id,
				title: row.label,
				subtitle: row.propertyName,
				href: `/abrechnung?propertyId=${row.propertyId}`,
			},
		})),
	);

	// --- Frei definierbare Verteilerschlüssel (WEG) -------------------------------------------
	const hoaAllocationKeyRows = getDb()
		.prepare(
			`SELECT c.id, c.label, c.notes, c.hoa_id AS hoaId, h.name AS hoaName
			 FROM hoa_custom_allocation_keys c JOIN hoas h ON h.id = c.hoa_id
			 ORDER BY c.label`
		)
		.all() as Array<{ id: string; label: string; notes: string | null; hoaId: string; hoaName: string }>;
	add(
		collectMatches(trimmed, hoaAllocationKeyRows, limit, (row) => ({
			haystack: hay(row.label, row.notes, row.hoaName),
			result: {
				type: "hoaAllocationKey",
				id: row.id,
				title: row.label,
				subtitle: row.hoaName,
				href: `/weg/verteilerschluessel?hoaId=${row.hoaId}`,
			},
		})),
	);

	// --- Benutzerkonten (NUR Admins - die API-Route entscheidet über includeUsers) --
	if (options.includeUsers) {
		const userRows = getDb()
			.prepare(`SELECT id, email, first_name AS firstName, last_name AS lastName, role FROM users ORDER BY email`)
			.all() as Array<{ id: string; email: string; firstName: string | null; lastName: string | null; role: string }>;
		add(
			collectMatches(trimmed, userRows, limit, (row) => {
				// Anzeige-Name als Titel (Fallback E-Mail bei Konten ohne
				// Namen), die jeweils andere Angabe als Untertitel.
				const name = userDisplayName(row);
				return {
					haystack: hay(row.email, row.firstName, row.lastName, row.role),
					result: {
						type: "user",
						id: row.id,
						title: name,
						subtitle: name === row.email ? row.role : row.email,
						href: "/admin/users",
					},
				};
			}),
		);
	}

	// --- Postfach: noch keinem Ticket zugeordnete eingehende E-Mails ----------------
	// (Ausgeblendete bleiben bewusst außen vor - sie sind aus der Ansicht
	// ausgeblendet, bis sie wieder eingeblendet werden.)
	const mailboxRows = getDb()
		.prepare(
			`SELECT id, subject, from_address AS fromAddress, body_text AS bodyText
			 FROM ticket_messages
			 WHERE ticket_id IS NULL AND direction = 'INBOUND' AND hidden = 0
			 ORDER BY created_at DESC
			 LIMIT ${SCAN_LIMIT}`
		)
		.all() as Array<{ id: string; subject: string | null; fromAddress: string | null; bodyText: string | null }>;
	add(
		collectMatches(trimmed, mailboxRows, limit, (row) => ({
			haystack: hay(row.subject, row.fromAddress, row.bodyText),
			result: {
				type: "mailboxMessage",
				id: row.id,
				title: row.subject || row.fromAddress || "",
				subtitle: row.subject ? row.fromAddress : null,
				href: "/postfach",
			},
		})),
	);

	return results;
}
