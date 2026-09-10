import { BATCH_TOOL_NAME, McpToolError, callTool, registerTool, type McpToolContext } from "./registry";

/**
 * Meta-Werkzeug "batch_execute": Führt mehrere Werkzeugaufrufe gebündelt
 * in EINEM Aufruf aus. Gedacht für externe KI-Agenten am MCP-Endpunkt
 * (eine Protokoll-Rundreise statt vieler - zusätzlich zum ohnehin
 * unterstützten JSON-RPC-Batch) ebenso wie für den internen KI-Assistenten
 * (src/lib/ai/chat.ts), der damit Massenoperationen in einer einzigen
 * Werkzeug-Runde erledigen kann.
 *
 * Semantik:
 * - Sequentielle Ausführung in der angegebenen Reihenfolge (die
 *   Repository-Schicht arbeitet synchron; Abhängigkeiten wie "anlegen,
 *   dann auflisten" verhalten sich dadurch deterministisch).
 * - Jeder Unteraufruf läuft über callTool mit dem Scope des Aufrufers -
 *   die Feld-Validierung, fachliche Sperren und die adminOnly-Prüfung
 *   gelten also je Aufruf unverändert.
 * - Ein fehlgeschlagener Unteraufruf bricht den Batch standardmäßig NICHT
 *   ab, sondern wird je Eintrag mit Fehlertext gemeldet (optional über
 *   stopOnError änderbar). Es gibt bewusst KEIN Gesamt-Rollback:
 *   erfolgreiche Aufrufe bleiben wirksam (Teilerfolg ist der Anwendungs-
 *   fall, z. B. Massenanlage aus einer Tabelle).
 * - Verschachtelung (batch_execute im Batch) ist gesperrt.
 *
 * Der Batch-Aufruf selbst schlägt nur bei formalen Fehlern des
 * Batch-Arguments fehl (fehlendes/leeres/überlanges calls-Array,
 * unbekannte Felder) - fachliche Fehler der Unteraufrufe sind Daten des
 * Ergebnisses, damit der Aufrufer sie gesammelt auswerten kann.
 */

/** Missbrauchs-/Fehler-Schranke: maximale Anzahl von Aufrufen je Batch. */
const MAX_BATCH_CALLS = 50;

interface BatchResultEntry {
	/** Position im calls-Array (0-basiert). */
	index: number;
	/** Name des aufgerufenen Werkzeugs (null bei formal ungültigem Eintrag). */
	name: string | null;
	ok: boolean;
	/** Ergebnis des Werkzeugs (nur bei ok=true). */
	result?: unknown;
	/** Fehlermeldung (nur bei ok=false). */
	error?: string;
}

registerTool({
	name: BATCH_TOOL_NAME,
	description:
		"Führt mehrere Werkzeugaufrufe gebündelt in einem einzigen Aufruf aus (sequentiell in der angegebenen " +
		"Reihenfolge). Gedacht für Massenoperationen (z. B. viele Datensätze anlegen) und zum Bündeln unabhängiger " +
		"Abfragen - spart Protokoll-Rundreisen. Jeder Unteraufruf wird gegen die Feld-Validierung und die " +
		"Zugriffsrechte geprüft. Ein fehlgeschlagener Aufruf bricht den Batch standardmäßig NICHT ab, sondern wird " +
		"je Eintrag mit Fehlertext gemeldet (über stopOnError änderbar). Es gibt kein Gesamt-Rollback: erfolgreich " +
		"ausgeführte Aufrufe bleiben wirksam. Verschachtelte Batches (batch_execute im Batch) sind nicht erlaubt. " +
		`Maximal ${MAX_BATCH_CALLS} Aufrufe je Batch.`,
	inputSchema: {
		type: "object",
		properties: {
			calls: {
				type: "array",
				description: "Liste der auszuführenden Werkzeugaufrufe (mindestens einer).",
				minItems: 1,
				maxItems: MAX_BATCH_CALLS,
				items: {
					type: "object",
					properties: {
						name: { type: "string", description: 'Name des Werkzeugs (z. B. "tenants_create")' },
						arguments: {
							type: "object",
							description: "Argumente des Werkzeugs gemäß dessen Schema (optional, Default: leeres Objekt).",
							additionalProperties: true,
						},
					},
					required: ["name"],
					additionalProperties: false,
				},
			},
			stopOnError: {
				type: "boolean",
				description:
					"true = beim ersten fehlgeschlagenen Aufruf abbrechen und die übrigen überspringen (Default: false - alle Aufrufe werden ausgeführt).",
			},
		},
		required: ["calls"],
		additionalProperties: false,
	},
	handler: async (args: Record<string, unknown>, context: McpToolContext) => {
		const unknownKeys = Object.keys(args).filter((key) => key !== "calls" && key !== "stopOnError");
		if (unknownKeys.length > 0) {
			throw new McpToolError(`Unbekannte Feld(er): ${unknownKeys.join(", ")}. Erlaubt: calls, stopOnError.`);
		}

		const rawCalls = args.calls;
		if (!Array.isArray(rawCalls) || rawCalls.length === 0) {
			throw new McpToolError('"calls" muss ein nicht-leeres Array von Werkzeugaufrufen sein.');
		}
		if (rawCalls.length > MAX_BATCH_CALLS) {
			throw new McpToolError(`Zu viele Aufrufe im Batch (${rawCalls.length}) - erlaubt sind höchstens ${MAX_BATCH_CALLS}.`);
		}

		const stopOnError = args.stopOnError ?? false;
		if (typeof stopOnError !== "boolean") {
			throw new McpToolError('"stopOnError" muss ein Boolean sein (true/false).');
		}

		const results: BatchResultEntry[] = [];
		for (const [index, rawEntry] of rawCalls.entries()) {
			const entry = rawEntry as { name?: unknown; arguments?: unknown } | null;
			const name = entry && typeof entry === "object" && !Array.isArray(entry) && typeof entry.name === "string" ? entry.name.trim() : null;

			// Formal ungültige Einträge und die Verschachtelungs-Sperre werden
			// wie fachliche Fehler je Eintrag gemeldet (nicht als Batch-Fehler) -
			// der Aufrufer soll den Rest trotzdem nutzen können.
			if (!name) {
				results.push({ index, name: null, ok: false, error: 'Jeder Aufruf benötigt ein Feld "name" (String).' });
				if (stopOnError) break;
				continue;
			}
			if (name === BATCH_TOOL_NAME) {
				results.push({ index, name, ok: false, error: "Verschachtelte Batches (batch_execute im Batch) sind nicht erlaubt." });
				if (stopOnError) break;
				continue;
			}

			const callArgs = (entry as { arguments?: unknown }).arguments ?? {};
			if (typeof callArgs !== "object" || callArgs === null || Array.isArray(callArgs)) {
				results.push({ index, name, ok: false, error: '"arguments" muss ein JSON-Objekt sein.' });
				if (stopOnError) break;
				continue;
			}

			try {
				const result = await callTool(name, callArgs, context.scope);
				results.push({ index, name, ok: true, result });
			} catch (error) {
				const message = error instanceof McpToolError ? error.message : "Interner Fehler bei der Ausführung (Details im Server-Log).";
				if (!(error instanceof McpToolError)) {
					console.error(`MCP-Batch-Unteraufruf "${name}" (Position ${index}) fehlgeschlagen:`, error);
				}
				results.push({ index, name, ok: false, error: message });
				if (stopOnError) break;
			}
		}

		const succeeded = results.filter((entry) => entry.ok).length;
		return {
			/** Angeforderte Aufrufe insgesamt. */
			total: rawCalls.length,
			/** Tatsächlich ausgeführte Aufrufe (< total bei stopOnError-Abbruch). */
			executed: results.length,
			succeeded,
			failed: results.length - succeeded,
			/** true = vorzeitig abgebrochen (stopOnError); übrige Aufrufe wurden übersprungen. */
			stoppedEarly: results.length < rawCalls.length,
			results,
		};
	},
});
