import { McpToolError, callTool, listToolDefinitions, type McpToolScope } from "./registry";

/**
 * MCP-Protokollschicht (Model Context Protocol) über "Streamable HTTP"
 * im einfachen, zustandslosen Request/Response-Modus: Der Client sendet
 * JSON-RPC-2.0-Nachrichten per POST an /api/mcp und erhält JSON-Antworten
 * (kein SSE-Stream, keine serverseitigen Sessions - für die hier
 * rein lesend/schreibend ausgeführten Werkzeugaufrufe nicht nötig und von
 * der Spezifikation ausdrücklich erlaubt).
 *
 * Unterstützte Methoden:
 * - initialize: Protokoll-Aushandlung (Capabilities, Server-Info)
 * - ping: Keepalive
 * - tools/list: alle im Scope sichtbaren Werkzeuge inkl. JSON-Schema
 * - tools/call: Werkzeug ausführen
 * - notifications/*: werden quittiert, ohne Antwortinhalt (HTTP 202)
 *
 * Der Scope ("ADMIN"/"USER") wird von der Route aus dem Zugriffs-Token
 * aufgelöst und hier an die Registry durchgereicht: Administrations-
 * Werkzeuge (adminOnly) sind im Scope "USER" weder gelistet noch aufrufbar.
 */

/** Ausgehandelte Protokollversionen, die dieser Server versteht. */
const SUPPORTED_PROTOCOL_VERSIONS = ["2024-11-05", "2025-03-26", "2025-06-18"];
const DEFAULT_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[SUPPORTED_PROTOCOL_VERSIONS.length - 1];

const SERVER_INFO = { name: "immobase", title: "ImmoBase MCP-Server", version: "1.0.0" };

// JSON-RPC-2.0-Fehlercodes
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

interface JsonRpcRequest {
	jsonrpc?: unknown;
	id?: string | number | null;
	method?: unknown;
	params?: unknown;
}

interface JsonRpcErrorResponse {
	jsonrpc: "2.0";
	id: string | number | null;
	error: { code: number; message: string };
}

function errorResponse(id: string | number | null, code: number, message: string): JsonRpcErrorResponse {
	return { jsonrpc: "2.0", id, error: { code, message } };
}

function successResponse(id: string | number, result: unknown) {
	return { jsonrpc: "2.0", id, result };
}

function isValidRequest(message: JsonRpcRequest): boolean {
	return message.jsonrpc === "2.0" && typeof message.method === "string";
}

/** Antwort eines Requests; `undefined` bei Notifications (keine Antwort). */
async function handleSingleRequest(message: JsonRpcRequest, scope: McpToolScope): Promise<unknown | undefined> {
	if (!isValidRequest(message)) {
		return errorResponse(message.id ?? null, INVALID_REQUEST, "Ungültige JSON-RPC-2.0-Nachricht.");
	}

	const method = message.method as string;
	const id = message.id;
	const isNotification = id === undefined || id === null;

	// Notifications erwarten keine Antwort (Spezifikation: HTTP 202).
	if (method.startsWith("notifications/")) {
		return undefined;
	}

	if (isNotification) {
		// Anfragen ohne ID, die keine Notification sind, sind ungültig.
		return errorResponse(null, INVALID_REQUEST, "Anfragen außer Notifications benötigen eine ID.");
	}

	switch (method) {
		case "initialize": {
			const params = (message.params ?? {}) as { protocolVersion?: unknown };
			const requestedVersion = typeof params.protocolVersion === "string" ? params.protocolVersion : null;
			const protocolVersion =
				requestedVersion && SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion) ? requestedVersion : DEFAULT_PROTOCOL_VERSION;
			return successResponse(id, {
				protocolVersion,
				capabilities: { tools: { listChanged: false } },
				serverInfo: SERVER_INFO,
				instructions:
					"ImmoBase (Miet- und WEG-Verwaltung). Alle Werkzeuge arbeiten direkt auf der lokalen Datenbank. " +
					"IDs vorhandener Datensätze über die *_list-Werkzeuge ermitteln. Geldbeträge als Dezimal-Strings " +
					"(\"123.45\"), Datumswerte als ISO-8601-Strings angeben. Lösch- und Finalisierungs-Werkzeuge wirken " +
					"unwiderruflich - vorher Rückfrage beim Nutzer halten. Mehrere voneinander unabhängige Operationen " +
					"(z. B. Massenanlagen oder mehrere Abfragen) können gebündelt über das Werkzeug batch_execute in " +
					"einem einzigen Aufruf ausgeführt werden (Ergebnis je Einzeloperation)." +
					(scope === "ADMIN"
						? ""
						: " Dieses Zugriffs-Token hat eingeschränkte Rechte: Administrations-Werkzeuge (z. B. Nutzerverwaltung) stehen nicht zur Verfügung."),
			});
		}

		case "ping":
			return successResponse(id, {});

		case "tools/list":
			return successResponse(id, { tools: listToolDefinitions(scope) });

		case "tools/call": {
			const params = message.params as { name?: unknown; arguments?: unknown } | undefined;
			if (!params || typeof params.name !== "string") {
				return errorResponse(id, INVALID_PARAMS, 'tools/call benötigt params.name (String).');
			}
			try {
				const result = await callTool(params.name, params.arguments ?? {}, scope);
				return successResponse(id, {
					content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
					isError: false,
				});
			} catch (error) {
				// Fachliche Fehler (Validierung, Sperren, nicht gefunden) und
				// unerwartete Fehler werden als Toolergebnis mit isError=true
				// gemeldet (MCP-Konvention), nicht als JSON-RPC-Fehler.
				const message = error instanceof McpToolError ? error.message : "Interner Fehler bei der Ausführung (Details im Server-Log).";
				if (!(error instanceof McpToolError)) {
					console.error(`MCP-Werkzeug "${params.name}" fehlgeschlagen:`, error);
				}
				return successResponse(id, {
					content: [{ type: "text", text: `Fehler: ${message}` }],
					isError: true,
				});
			}
		}

		default:
			return errorResponse(id, METHOD_NOT_FOUND, `Unbekannte Methode: "${method}".`);
	}
}

export interface McpHttpResult {
	status: number;
	/** Antwortkörper; undefined = keine Antwort (202). */
	body: unknown;
}

/**
 * Verarbeitet den rohen Request-Body einer POST-Anfrage an /api/mcp
 * (einzelne JSON-RPC-Nachricht oder Batch-Array). `scope` ist die aus dem
 * Zugriffs-Token aufgelöste Zugriffsebene des Aufrufers (Route reicht sie
 * durch; Default "ADMIN" nur für direkte In-Process-Aufrufe, z. B. Tests).
 */
export async function handleMcpPost(rawBody: string, scope: McpToolScope = "ADMIN"): Promise<McpHttpResult> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(rawBody);
	} catch {
		return { status: 400, body: errorResponse(null, PARSE_ERROR, "Der Request-Body ist kein gültiges JSON.") };
	}

	if (Array.isArray(parsed)) {
		if (parsed.length === 0) {
			return { status: 400, body: errorResponse(null, INVALID_REQUEST, "Leerer Batch ist nicht erlaubt.") };
		}
		const responses = (await Promise.all(parsed.map((message) => handleSingleRequest(message as JsonRpcRequest, scope)))).filter(
			(response) => response !== undefined
		);
		// Bestand der Batch nur aus Notifications, gibt es keine Antwort.
		if (responses.length === 0) return { status: 202, body: undefined };
		return { status: 200, body: responses };
	}

	if (typeof parsed !== "object" || parsed === null) {
		return { status: 400, body: errorResponse(null, INVALID_REQUEST, "Erwartet wird eine JSON-RPC-Nachricht (Objekt oder Batch-Array).") };
	}

	const response = await handleSingleRequest(parsed as JsonRpcRequest, scope);
	if (response === undefined) return { status: 202, body: undefined };
	return { status: 200, body: response };
}

/** Lesbare Fehlermeldung für interne Serverfehler als JSON-RPC-Fehler. */
export function internalErrorBody(): JsonRpcErrorResponse {
	return errorResponse(null, INTERNAL_ERROR, "Interner Serverfehler.");
}
