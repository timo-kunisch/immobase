/**
 * Werkzeug-Registry des MCP-Servers: Definiert die MCP-Tools (Name,
 * Beschreibung, JSON-Schema, Handler) und bündelt die
 * Argumenten-Validierung sowie einen CRUD-Generator, mit dem die
 * Standard-Werkzeuge je Fach-Entität (list/get/create/update/delete)
 * kompakt aus dem Repository-Layer (src/data/) erzeugt werden.
 *
 * Konventionen:
 * - Handler arbeiten AUSSCHLIESSLICH über die Repositories aus src/data/
 *   bzw. die fachlichen Berechnungs-Funktionen aus src/lib/ - niemals
 *   direktes SQL.
 * - Fachliche Fehler (Validierung, Sperren wie "nur Entwürfe löschbar",
 *   "nicht gefunden") werden als McpToolError geworfen und vom
 *   Protokoll-Handler als MCP-Toolergebnis mit isError=true gemeldet
 *   (statt als JSON-RPC-Protokollfehler).
 * - Geldbeträge sind Decimal-Strings ("123.45"), Datumswerte ISO-8601
 *   (siehe src/data/types.ts). Der Validator akzeptiert bei Beträgen
 *   zusätzlich Zahlen und Komma-Schreibweise, bei Datumsangaben jedes
 *   von Date.parse verstandene Format, und normalisiert beides.
 */

/** Fachlicher Fehler eines Tool-Aufrufs (wird als isError-Result gemeldet). */
export class McpToolError extends Error {}

/**
 * Zugriffsebene eines Aufrufers der Werkzeug-Registry:
 * - "ADMIN": alle Werkzeuge (inkl. der als adminOnly markierten
 *   Administrations-Werkzeuge wie Nutzerverwaltung/Stammdaten-Einstellungen).
 * - "USER": nur fachliche Werkzeuge - entspricht dem, was ein normaler Nutzer
 *   auch in der App-Oberfläche darf (Admin-Bereich und Einstellungen sind
 *   dort admins-only, siehe src/app/(app)/admin/ bzw. .../einstellungen/).
 *
 * Die Einstiegspunkte (MCP-Route über das Zugriffs-Token, Chat-Route über
 * die Session-Rolle) bestimmen den Scope autoritativ und reichen ihn durch.
 */
export type McpToolScope = "ADMIN" | "USER";

// ------------------------------------------------------------
// Feld-Spezifikationen (erzeugen JSON-Schema + Validierung)
// ------------------------------------------------------------

export interface FieldSpec {
	/** string: Text; decimal: Geldbetrag; date: ISO-Datum; int/float: Zahl; boolean; enum: Wert aus `values`. */
	type: "string" | "decimal" | "date" | "int" | "float" | "boolean" | "enum";
	/** Feld darf fehlen/null sein (Default beim Anlegen: null). */
	nullable?: boolean;
	/** Erlaubte Werte (nur type "enum"). */
	values?: readonly string[];
	description?: string;
}

function fieldToJsonSchema(spec: FieldSpec): Record<string, unknown> {
	let schema: Record<string, unknown>;
	switch (spec.type) {
		case "string":
			schema = { type: "string" };
			break;
		case "decimal":
			schema = { type: ["string", "number"] };
			break;
		case "date":
			schema = { type: "string" };
			break;
		case "int":
			schema = { type: "integer" };
			break;
		case "float":
			schema = { type: "number" };
			break;
		case "boolean":
			schema = { type: "boolean" };
			break;
		case "enum":
			schema = { type: "string", enum: [...(spec.values ?? [])] };
			break;
	}
	if (spec.nullable) {
		schema = { anyOf: [schema, { type: "null" }] };
	}
	if (spec.description) {
		schema.description = spec.description;
	}
	return schema;
}

/** Erzeugt das JSON-Schema (type "object") für eine Feld-Map. */
export function buildInputSchema(fields: Record<string, FieldSpec>): Record<string, unknown> {
	const properties: Record<string, unknown> = {};
	const required: string[] = [];
	for (const [key, spec] of Object.entries(fields)) {
		properties[key] = fieldToJsonSchema(spec);
		if (!spec.nullable) required.push(key);
	}
	return {
		type: "object",
		properties,
		required,
		additionalProperties: false,
	};
}

const DECIMAL_PATTERN = /^-?\d+(\.\d{1,4})?$/;

function coerceDecimal(field: string, value: unknown): string {
	const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim().replace(",", ".") : null;
	if (raw === null || !DECIMAL_PATTERN.test(raw)) {
		throw new McpToolError(`Feld "${field}" muss ein Dezimalbetrag sein (z. B. "123.45").`);
	}
	return raw;
}

function coerceDate(field: string, value: unknown): string {
	if (typeof value !== "string" || value.trim() === "") {
		throw new McpToolError(`Feld "${field}" muss ein ISO-8601-Datum als String sein.`);
	}
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		throw new McpToolError(`Feld "${field}" ist kein gültiges Datum ("${value}").`);
	}
	return parsed.toISOString();
}

function coerceNumber(field: string, value: unknown, integerOnly: boolean): number {
	// Deutsche Komma-Schreibweise ("65,5") wird ebenfalls akzeptiert.
	const numeric = typeof value === "string" && value.trim() !== "" ? Number(value.trim().replace(",", ".")) : value;
	if (typeof numeric !== "number" || !Number.isFinite(numeric) || (integerOnly && !Number.isInteger(numeric))) {
		throw new McpToolError(`Feld "${field}" muss ${integerOnly ? "eine ganze Zahl" : "eine Zahl"} sein.`);
	}
	return numeric;
}

/**
 * Validiert/normalisiert die Tool-Argumente gegen die Feld-Spezifikation.
 * Wirft McpToolError bei Verstößen; unbekannte Felder werden abgelehnt,
 * damit Tippfehler nicht still ignoriert werden.
 */
export function coerceArgs(fields: Record<string, FieldSpec>, args: unknown): Record<string, unknown> {
	if (typeof args !== "object" || args === null || Array.isArray(args)) {
		throw new McpToolError("Die Argumente müssen ein JSON-Objekt sein.");
	}
	const input = args as Record<string, unknown>;

	const unknownKeys = Object.keys(input).filter((key) => !(key in fields));
	if (unknownKeys.length > 0) {
		throw new McpToolError(`Unbekannte Feld(er): ${unknownKeys.join(", ")}. Erlaubt: ${Object.keys(fields).join(", ")}.`);
	}

	const result: Record<string, unknown> = {};
	for (const [key, spec] of Object.entries(fields)) {
		const value = input[key];
		if (value === undefined || value === null || (spec.type === "string" && value === "")) {
			if (spec.nullable) {
				result[key] = null;
				continue;
			}
			throw new McpToolError(`Pflichtfeld "${key}" fehlt.`);
		}
		switch (spec.type) {
			case "string":
				if (typeof value !== "string") throw new McpToolError(`Feld "${key}" muss ein String sein.`);
				if (!spec.nullable && value.trim() === "") throw new McpToolError(`Pflichtfeld "${key}" darf nicht leer sein.`);
				result[key] = value.trim();
				break;
			case "decimal":
				result[key] = coerceDecimal(key, value);
				break;
			case "date":
				result[key] = coerceDate(key, value);
				break;
			case "int":
				result[key] = coerceNumber(key, value, true);
				break;
			case "float":
				result[key] = coerceNumber(key, value, false);
				break;
			case "boolean":
				if (typeof value !== "boolean") throw new McpToolError(`Feld "${key}" muss ein Boolean sein (true/false).`);
				result[key] = value;
				break;
			case "enum":
				if (typeof value !== "string" || !(spec.values ?? []).includes(value)) {
					throw new McpToolError(`Feld "${key}" muss einer der Werte sein: ${(spec.values ?? []).join(", ")}.`);
				}
				result[key] = value;
				break;
		}
	}
	return result;
}

// ------------------------------------------------------------
// Tool-Definition und Registry
// ------------------------------------------------------------

export interface McpTool {
	name: string;
	description: string;
	/** JSON-Schema (type "object") der Argumente. */
	inputSchema: Record<string, unknown>;
	/**
	 * true = Administrations-Werkzeug: steht nur im Scope "ADMIN" zur
	 * Verfügung (weder in tools/list sichtbar noch per tools/call aufrufbar).
	 * Für Werkzeuge zu markieren, deren Fachfunktion auch in der App nur
	 * Administratoren offensteht (Nutzerverwaltung, Einstellungen).
	 */
	adminOnly?: boolean;
	/** Führt das Werkzeug aus; Rückgabewert wird dem Client als JSON-Text geliefert. */
	handler: (args: Record<string, unknown>) => unknown | Promise<unknown>;
}

const tools = new Map<string, McpTool>();

export function registerTool(tool: McpTool): void {
	if (tools.has(tool.name)) throw new Error(`MCP-Tool doppelt registriert: ${tool.name}`);
	tools.set(tool.name, tool);
}

export function registerTools(definitions: McpTool[]): void {
	for (const tool of definitions) registerTool(tool);
}

/** Alle im Scope sichtbaren Werkzeuge ohne Handler (für tools/list). */
export function listToolDefinitions(scope: McpToolScope = "ADMIN"): Omit<McpTool, "handler">[] {
	return [...tools.values()]
		.filter((tool) => scope === "ADMIN" || !tool.adminOnly)
		.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
}

/**
 * Führt ein Werkzeug aus. Wirft McpToolError bei unbekanntem Namen bzw.
 * wenn ein Admin-Werkzeug im Scope "USER" aufgerufen wird.
 */
export async function callTool(name: string, args: unknown, scope: McpToolScope = "ADMIN"): Promise<unknown> {
	const tool = tools.get(name);
	if (!tool) throw new McpToolError(`Unbekanntes Werkzeug: "${name}".`);
	if (tool.adminOnly && scope !== "ADMIN") {
		throw new McpToolError(`Das Werkzeug "${name}" steht nur Administratoren zur Verfügung.`);
	}
	return tool.handler((args ?? {}) as Record<string, unknown>);
}

// ------------------------------------------------------------
// CRUD-Generator (Standard-Werkzeuge je Entität)
// ------------------------------------------------------------

/**
 * TInput: der Eingabetyp des zugehörigen Repositories (z. B. PropertyInput).
 * Die Feld-Spezifikation (`fields`) wird per Hand passend zu diesem Typ
 * gepflegt; coerceArgs validiert zur Laufzeit dagegen, sodass die
 * Typkonformität an genau dieser Stelle gebündelt ist.
 */
export interface CrudToolConfig<TInput> {
	/** Technischer Name der Entität (Tool-Präfix), z. B. "properties". */
	entity: string;
	/** Deutsche Bezeichnung für Beschreibungen/Fehlermeldungen, z. B. "Liegenschaft". */
	entityLabel: string;
	/** Felder für create/update (Update = vollständiger Ersatz, wie in den Formularen der App). */
	fields: Record<string, FieldSpec>;
	/** Beschreibender Hinweis zu den Feldern (Enum-/Format-Erklärungen) für create/update. */
	fieldsHint?: string;
	list: (filterArgs: Record<string, unknown>) => unknown;
	get?: (id: string) => unknown;
	create: (input: TInput) => unknown;
	update: (id: string, input: TInput) => void;
	delete: (id: string) => void;
	/** Optionale Filter-Felder für das list-Werkzeug. */
	listFilters?: Record<string, FieldSpec>;
	/** true = alle fünf Werkzeuge der Entität stehen nur im Scope "ADMIN". */
	adminOnly?: boolean;
	/** Zusätzliche fachliche Prüfung vor create (Fehlertext oder null). */
	beforeCreate?: (input: TInput) => string | null;
	/** Zusätzliche fachliche Prüfung vor update/delete (Fehlertext oder null). */
	beforeUpdate?: (id: string, input: TInput) => string | null;
	beforeDelete?: (id: string) => string | null;
}

function requireId(args: unknown): string {
	if (typeof args !== "object" || args === null || Array.isArray(args)) {
		throw new McpToolError("Die Argumente müssen ein JSON-Objekt sein.");
	}
	const id = (args as Record<string, unknown>).id;
	if (typeof id !== "string" || id.trim() === "") {
		throw new McpToolError('Pflichtfeld "id" fehlt.');
	}
	return id.trim();
}

/**
 * Erzeugt die fünf Standard-CRUD-Werkzeuge einer Entität
 * (<entity>_list, _get, _create, _update, _delete).
 */
export function registerCrudTools<TInput>(config: CrudToolConfig<TInput>): void {
	const { entity, entityLabel, fields, adminOnly } = config;

	registerTool({
		name: `${entity}_list`,
		description: `Listet ${entityLabel}n auf.${config.listFilters ? " Optional filterbar." : ""}`,
		inputSchema: buildInputSchema(config.listFilters ?? {}),
		adminOnly,
		handler: (args) => {
			const filter = coerceArgs(config.listFilters ?? ({} as Record<string, FieldSpec>), args);
			return config.list(filter);
		},
	});

	if (config.get) {
		const get = config.get;
		registerTool({
			name: `${entity}_get`,
			description: `Liefert eine ${entityLabel} per ID.`,
			inputSchema: buildInputSchema({ id: { type: "string", description: "ID des Datensatzes" } }),
			adminOnly,
			handler: (args) => {
				const id = requireId(args);
				const record = get(id);
				if (!record) throw new McpToolError(`${entityLabel} mit ID "${id}" wurde nicht gefunden.`);
				return record;
			},
		});
	}

	registerTool({
		name: `${entity}_create`,
		description: `Legt eine ${entityLabel} an und liefert den neuen Datensatz (inkl. ID).${config.fieldsHint ? ` ${config.fieldsHint}` : ""}`,
		inputSchema: buildInputSchema(fields),
		adminOnly,
		handler: (args) => {
			const input = coerceArgs(fields, args) as unknown as TInput;
			const guardError = config.beforeCreate?.(input);
			if (guardError) throw new McpToolError(guardError);
			return config.create(input);
		},
	});

	registerTool({
		name: `${entity}_update`,
		description: `Aktualisiert eine ${entityLabel} (vollständiger Ersatz aller Felder wie im Bearbeiten-Dialog der App).`,
		inputSchema: buildInputSchema({ id: { type: "string", description: "ID des Datensatzes" }, ...fields }),
		adminOnly,
		handler: (args) => {
			const id = requireId(args);
			// "id" ist Transportfeld, kein Fachfeld - vor der Feldvalidierung entfernen.
			const { id: _ignored, ...rest } = args as Record<string, unknown>;
			const input = coerceArgs(fields, rest) as unknown as TInput;
			if (config.get && !config.get(id)) throw new McpToolError(`${entityLabel} mit ID "${id}" wurde nicht gefunden.`);
			const guardError = config.beforeUpdate?.(id, input);
			if (guardError) throw new McpToolError(guardError);
			config.update(id, input);
			return { success: true, id };
		},
	});

	registerTool({
		name: `${entity}_delete`,
		description: `Löscht eine ${entityLabel} unwiderruflich.`,
		inputSchema: buildInputSchema({ id: { type: "string", description: "ID des Datensatzes" } }),
		adminOnly,
		handler: (args) => {
			const id = requireId(args);
			if (config.get && !config.get(id)) throw new McpToolError(`${entityLabel} mit ID "${id}" wurde nicht gefunden.`);
			const guardError = config.beforeDelete?.(id);
			if (guardError) throw new McpToolError(guardError);
			config.delete(id);
			return { success: true, id };
		},
	});
}
