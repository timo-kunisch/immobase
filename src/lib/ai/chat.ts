import { AttachmentError, processAttachment } from "./attachments";
import { AiClientError, createChatCompletion, type OpenAiMessage, type OpenAiTool } from "./client";
import { getAiConfig } from "./config";
import { McpToolError } from "@/lib/mcp/registry";

// Registriert alle Werkzeuge der MCP-Registry als Seiteneffekt - der
// Chatbot nutzt exakt dieselben Werkzeug-Definitionen und Handler wie der
// MCP-Endpunkt (/api/mcp), nur in-process (ohne HTTP-/Token-Umweg, die
// autoritative Prüfung liegt in der Chat-Route über die Nutzer-Session).
import { callTool, listToolDefinitions } from "@/lib/mcp/tools";

/**
 * Orchestrierung des KI-Chats (Sidebar-Sprechblase): Führt die Unterhaltung
 * gegen den konfigurierten OpenAI-kompatiblen Endpunkt und räumt dem Modell
 * dabei Zugriff auf sämtliche Fachdaten ein - die Werkzeuge der
 * MCP-Registry (src/lib/mcp/) werden als OpenAI-Function-Tools angeboten
 * und vom Modell angeforderte Aufrufe hier lokal ausgeführt (Tool-Loop).
 *
 * Ablauf je Nutzernachricht:
 * 1. System-Prompt + bisheriger Verlauf + ggf. extrahierter Anhang-Text.
 * 2. Endpunkt-Aufruf; fordert das Modell Werkzeuge an, werden sie
 *    ausgeführt, die Ergebnisse als role:"tool"-Nachrichten angehängt und
 *    erneut angefragt (max. MAX_TOOL_ROUNDS Runden als Schleifen-Schutz).
 * 3. Die erste Antwort ohne Werkzeug-Anforderung ist die finale Antwort.
 *
 * Sicherheitsmodell: Die Werkzeuge haben faktisch Admin-Rechte (gleiche
 * Lage wie beim MCP-Token). Die Chat-Route ist daher ausschließlich für
 * Administratoren freigegeben (Prüfung dort, autoritativ).
 */

/** Fachlicher Eingabe-/Ablauffehler des Chats (wird dem Nutzer gemeldet). */
export class ChatError extends Error {}

export interface ChatHistoryMessage {
	role: "user" | "assistant";
	content: string;
}

export interface ChatAttachmentInput {
	name: string;
	dataBase64: string;
}

export interface ExecutedToolCall {
	name: string;
	ok: boolean;
	/** Kurze Fehlermeldung (nur bei ok=false). */
	detail?: string;
}

export interface ChatRunResult {
	reply: string;
	/** Alle in diesem Durchlauf ausgeführten Werkzeugaufrufe (für die UI). */
	toolCalls: ExecutedToolCall[];
}

/** Schleifen-Schutz: maximale Werkzeug-Runden je Nutzernachricht. */
const MAX_TOOL_ROUNDS = 15;
/**
 * Werkzeug-Ergebnisse (z. B. große *_list-Ausgaben) werden gekürzt, damit
 * sie das Kontextfenster des Modells nicht sprengen.
 */
const MAX_TOOL_RESULT_CHARS = 40_000;

function buildSystemPrompt(userEmail: string): string {
	const today = new Date().toISOString().slice(0, 10);
	return [
		"Du bist der KI-Assistent von ImmoBase, einer Desktop-Anwendung zur Miet- und WEG-Verwaltung (deutsches Mietrecht bzw. WEG i. d. F. der Reform 2020).",
		"Du hast über die bereitgestellten Werkzeuge vollständigen Lese- und Schreibzugriff auf die Live-Daten der Anwendung: Liegenschaften, Einheiten, Mieter, Verträge, Kautionen, Tickets, Dokumente, Finanzen, Nebenkostenabrechnungen, Dokumentvorlagen sowie die WEG-Verwaltung (Eigentümer, Eigentumsverhältnisse, Verteilerschlüssel, Wirtschaftspläne, Jahresabrechnungen, Hausgeld, Erhaltungsrücklage, Versammlungen, Beschluss-Sammlung).",
		"",
		"Verhaltensregeln:",
		"- Antworte auf Deutsch, sachlich und prägnant. Fasse dich kurz; bei langen Ergebnissen nutze Listen/Tabellen.",
		"- Nutze die Werkzeuge, um aktuelle Daten abzufragen, statt zu raten oder zu erfinden. IDs vorhandener Datensätze ermittelst du über die *_list-Werkzeuge (mit Filtern), Details über die *_get-Werkzeuge.",
		"- Geldbeträge sind Dezimal-Strings (\"123.45\"), Datumswerte ISO-8601 (\"2026-09-08\"). Die Werkzeuge akzeptieren bei Beträgen auch Komma-Schreibweise.",
		"- Vor destruktiven oder unwiderruflichen Aktionen (Löschen, Finalisieren von Abrechnungen/Wirtschaftsplänen/Jahresabrechnungen) fasse die geplante Aktion samt betroffenen Datensätzen kurz zusammen und hole die ausdrückliche Bestätigung des Nutzers ein - es sei denn, der Nutzer hat die Aktion bereits eindeutig angefordert.",
		"- Wenn der Nutzer Dateien anhängt (z. B. Excel-Tabellen, PDFs, Office-Dokumente), wird deren Inhalt als Text in seine Nachricht eingefügt; angehängte Bilder werden dir direkt als Bild-Input übergeben. Übernimm Daten aus den Anhängen gewissenhaft über die passenden *_create-Werkzeuge. Prüfe vor dem Anlegen, welche verknüpften Datensätze (z. B. Liegenschaft, Einheit) bereits existieren, und berichte abschließend knapp, was angelegt wurde und was nicht geklappt hat.",
		"- Melde Werkzeug-Fehler (isError/Fehlertext) ehrlich zurück und versuche nicht, sie zu verbergen.",
		"",
		`Aktuelles Datum: ${today}. Angemeldeter Nutzer: ${userEmail}.`,
	].join("\n");
}

/** MCP-Tool-Definitionen → OpenAI-Function-Tools (JSON-Schema wird 1:1 übernommen). */
function buildOpenAiTools(): OpenAiTool[] {
	return listToolDefinitions().map((tool) => ({
		type: "function",
		function: {
			name: tool.name,
			description: tool.description,
			parameters: tool.inputSchema,
		},
	}));
}

function truncateToolResult(text: string): string {
	if (text.length <= MAX_TOOL_RESULT_CHARS) return text;
	return `${text.slice(0, MAX_TOOL_RESULT_CHARS)}\n[... gekürzt: Das Werkzeug-Ergebnis überschreitet die maximale Länge von ${MAX_TOOL_RESULT_CHARS} Zeichen. Nutze Filter oder *_get-Werkzeuge für gezieltere Abfragen. ...]`;
}

/**
 * Führt eine Chat-Runde inkl. aller angeforderten Werkzeugaufrufe aus.
 * Wirft ChatError (fachlich, UI-tauglich) oder AiClientError (Endpunkt).
 */
export async function runChat(input: {
	messages: ChatHistoryMessage[];
	attachments: ChatAttachmentInput[];
	userEmail: string;
}): Promise<ChatRunResult> {
	const config = getAiConfig();
	if (!config) {
		throw new ChatError("Es ist kein KI-Endpunkt konfiguriert. Einrichtung: Einstellungen → KI-Assistent.");
	}

	// Anhänge serverseitig aufbereiten: Text-Inhalte werden der letzten
	// Nutzernachricht beigelegt, Bilder als eigene Vision-Content-Parts
	// (OpenAI-"image_url" mit Base64-Data-URL) - die wenigsten Endpunkte
	// akzeptieren Datei-Uploads direkt.
	let attachmentSection = "";
	const imageParts: { type: "image_url"; image_url: { url: string } }[] = [];
	for (const attachment of input.attachments) {
		let processed;
		try {
			processed = await processAttachment(attachment.name, attachment.dataBase64);
		} catch (error) {
			if (error instanceof AttachmentError) throw new ChatError(error.message);
			console.error("[ai] Anhang-Verarbeitung fehlgeschlagen:", error);
			throw new ChatError(`Der Anhang "${attachment.name}" konnte nicht verarbeitet werden (Details im Server-Log).`);
		}
		if (processed.kind === "image") {
			imageParts.push({ type: "image_url", image_url: { url: `data:${processed.mimeType};base64,${processed.dataBase64}` } });
		} else {
			attachmentSection += `\n\n--- Beginn Datei-Anhang "${attachment.name}" ---\n${processed.text}\n--- Ende Datei-Anhang "${attachment.name}" ---`;
		}
	}

	const openAiMessages: OpenAiMessage[] = [{ role: "system", content: buildSystemPrompt(input.userEmail) }];
	for (let index = 0; index < input.messages.length; index++) {
		const message = input.messages[index];
		const isLastUserMessage = index === input.messages.length - 1 && message.role === "user";
		if (!isLastUserMessage) {
			openAiMessages.push({ role: message.role, content: message.content });
			continue;
		}
		const text = `${message.content}${attachmentSection}`;
		// Mit Bildern muss der Inhalt als Content-Part-Array gesendet werden
		// (OpenAI-Multimodal-Format); ohne Bilder bleibt es ein schlichter String.
		openAiMessages.push({
			role: "user",
			content: imageParts.length > 0 ? [{ type: "text" as const, text }, ...imageParts] : text,
		});
	}

	const tools = buildOpenAiTools();
	const executed: ExecutedToolCall[] = [];

	for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
		const assistantMessage = await createChatCompletion(config, openAiMessages, tools);
		const requestedCalls = (assistantMessage.tool_calls ?? []).filter((call) => call.type === "function");

		if (requestedCalls.length === 0) {
			// Content-Parts kommen nur in Nutzernachrichten vor - die
			// Assistant-Antwort ist definitionsgemäß ein String (oder null).
			const reply = (typeof assistantMessage.content === "string" ? assistantMessage.content : "").trim();
			if (!reply) {
				throw new AiClientError("Das Modell hat eine leere Antwort geliefert. Bitte versuchen Sie es erneut.");
			}
			return { reply, toolCalls: executed };
		}

		// Assistant-Nachricht inkl. tool_calls in den Verlauf, dann jedes
		// Werkzeug ausführen und als role:"tool"-Antwort anhängen.
		openAiMessages.push({ role: "assistant", content: assistantMessage.content ?? null, tool_calls: requestedCalls });

		for (const call of requestedCalls) {
			let args: unknown = {};
			try {
				args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
			} catch {
				executed.push({ name: call.function.name, ok: false, detail: "Ungültige Argumente (kein JSON) des Modells." });
				openAiMessages.push({
					role: "tool",
					tool_call_id: call.id,
					content: "Fehler: Die angeforderten Argumente sind kein gültiges JSON - bitte erneut versuchen.",
				});
				continue;
			}
			try {
				const result = await callTool(call.function.name, args);
				executed.push({ name: call.function.name, ok: true });
				openAiMessages.push({
					role: "tool",
					tool_call_id: call.id,
					content: truncateToolResult(JSON.stringify(result ?? null, null, 2)),
				});
			} catch (error) {
				// Fachliche Fehler (Validierung, Sperren, nicht gefunden) gehen
				// als Tool-Ergebnis zurück ans Modell - es kann darauf reagieren
				// (korrigierter Aufruf oder Rückmeldung an den Nutzer).
				const detail =
					error instanceof McpToolError ? error.message : "Interner Fehler bei der Ausführung (Details im Server-Log).";
				if (!(error instanceof McpToolError)) {
					console.error(`[ai] Werkzeug "${call.function.name}" fehlgeschlagen:`, error);
				}
				executed.push({ name: call.function.name, ok: false, detail });
				openAiMessages.push({ role: "tool", tool_call_id: call.id, content: `Fehler: ${detail}` });
			}
		}
	}

	throw new AiClientError(
		`Das Modell hat die maximale Anzahl von ${MAX_TOOL_ROUNDS} Werkzeug-Runden überschritten. Bitte formulieren Sie die Anfrage kleiner oder konkreter.`
	);
}
