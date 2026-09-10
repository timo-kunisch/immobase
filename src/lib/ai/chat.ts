import { AttachmentError, processAttachment } from "./attachments";
import { AiClientError, createChatCompletion, type OpenAiMessage, type OpenAiTool } from "./client";
import { getAiConfig } from "./config";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { createTranslator, type TranslateFn } from "@/lib/i18n/translator";
import { McpToolError, type McpToolScope } from "@/lib/mcp/registry";

// Registriert alle Werkzeuge der MCP-Registry als Seiteneffekt - der
// Chatbot nutzt exakt dieselben Werkzeug-Definitionen und Handler wie der
// MCP-Endpunkt (/api/mcp), nur in-process (ohne HTTP-/Token-Umweg, die
// autoritative Prüfung liegt in der Chat-Route über die Nutzer-Session).
import { BATCH_TOOL_NAME, callTool, listToolDefinitions } from "@/lib/mcp/tools";

/**
 * Orchestrierung des KI-Chats (Sidebar-Sprechblase): Führt die Unterhaltung
 * gegen den konfigurierten OpenAI-kompatiblen Endpunkt und räumt dem Modell
 * dabei Zugriff auf die Fachdaten ein - die Werkzeuge der MCP-Registry
 * (src/lib/mcp/) werden als OpenAI-Function-Tools angeboten und vom Modell
 * angeforderte Aufrufe hier lokal ausgeführt (Tool-Loop).
 *
 * Ablauf je Nutzernachricht:
 * 1. System-Prompt + bisheriger Verlauf + ggf. extrahierter Anhang-Text.
 * 2. Endpunkt-Aufruf; fordert das Modell Werkzeuge an, werden sie
 *    ausgeführt, die Ergebnisse als role:"tool"-Nachrichten angehängt und
 *    erneut angefragt (max. MAX_TOOL_ROUNDS Runden als Schleifen-Schutz).
 *    Nähert sich das Modell dem Limit, weist ein System-Hinweis auf das
 *    verbleibende Budget hin (soll rechtzeitig zum Abschluss steuern).
 * 3. Die erste Antwort ohne Werkzeug-Anforderung ist die finale Antwort.
 * 4. Ist das Limit erschöpft, schlägt die Anfrage NICHT fehl: In einer
 *    Schlussrunde OHNE Werkzeugangebot fasst das Modell den erreichten
 *    Zwischenstand zusammen und benennt, was noch offen ist (der Nutzer
 *    kann die Fortsetzung z. B. mit "weiter" anstoßen). Erst wenn auch
 *    diese Runde keine Antwort liefert, greift ein fester Fallback-Text.
 *
 * Sicherheitsmodell: Der Chat steht allen angemeldeten Nutzern offen. Die
 * Rolle des Nutzers (aus der Session, von der Chat-Route übergeben)
 * bestimmt den Werkzeug-Scope: Administratoren erhalten alle Werkzeuge,
 * normale Nutzer nur die fachlichen - exakt die Funktionen, die ihnen auch
 * in der App-Oberfläche offenstehen (Administrations-Werkzeuge wie
 * Nutzerverwaltung/Absenderdaten sind adminOnly, siehe
 * src/lib/mcp/registry.ts).
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

/**
 * Schleifen-Schutz: maximale Werkzeug-Runden je Nutzernachricht. Muss
 * großzügig bemessen sein, damit Massenanlagen aus Datei-Anhängen (z. B.
 * Mieterlisten aus Excel) in einem Durchlauf durchlaufen; das Limit ist
 * kein harter Abbruch mehr, sondern leitet die Schlussrunde ein (siehe
 * unten).
 */
const MAX_TOOL_ROUNDS = 25;
/**
 * Ab so vielen verbleibenden Werkzeug-Runden erhält das Modell einen
 * System-Hinweis auf das schwindende Budget, damit es rechtzeitig zum
 * Abschluss steuert (statt unvorbereitet im Limit zu landen).
 */
const BUDGET_WARNING_REMAINING = 5;
/**
 * Werkzeug-Ergebnisse (z. B. große *_list-Ausgaben) werden gekürzt, damit
 * sie das Kontextfenster des Modells nicht sprengen.
 */
const MAX_TOOL_RESULT_CHARS = 40_000;

function buildSystemPrompt(t: TranslateFn, userEmail: string, scope: McpToolScope): string {
	const today = new Date().toISOString().slice(0, 10);
	return [
		t("chat.system.intro"),
		t("chat.system.access"),
		"",
		t("chat.system.rulesHeader"),
		t("chat.system.ruleLanguage"),
		t("chat.system.ruleTools"),
		t("chat.system.ruleBatch"),
		t("chat.system.ruleFormats"),
		t("chat.system.ruleDestructive"),
		t("chat.system.ruleAttachments"),
		t("chat.system.ruleToolErrors"),
		...(scope === "ADMIN" ? [] : [t("chat.system.ruleUserScope")]),
		"",
		t("chat.system.footer", { today, userEmail }),
	].join("\n");
}

/** MCP-Tool-Definitionen → OpenAI-Function-Tools (JSON-Schema wird 1:1 übernommen, scope-gefiltert). */
function buildOpenAiTools(scope: McpToolScope): OpenAiTool[] {
	return listToolDefinitions(scope).map((tool) => ({
		type: "function",
		function: {
			name: tool.name,
			description: tool.description,
			parameters: tool.inputSchema,
		},
	}));
}

function truncateToolResult(t: TranslateFn, text: string): string {
	if (text.length <= MAX_TOOL_RESULT_CHARS) return text;
	return `${text.slice(0, MAX_TOOL_RESULT_CHARS)}\n${t("chat.system.toolResultTruncated", { max: MAX_TOOL_RESULT_CHARS })}`;
}

/**
 * Ermittelt die UI-Einträge eines erfolgreich ausgeführten Werkzeugs.
 * Beim Batch-Werkzeug werden die Einzelaufrufe flach ausgewiesen, damit
 * im Dialog sichtbar ist, welche Operationen tatsächlich gelaufen sind -
 * inklusive der fehlgeschlagenen (sonst stünde dort nur ein pauschal
 * "erfolgreiches" batch_execute).
 */
function summarizeToolExecution(name: string, result: unknown): ExecutedToolCall[] {
	if (name !== BATCH_TOOL_NAME || typeof result !== "object" || result === null) {
		return [{ name, ok: true }];
	}
	const batchResults = (result as { results?: unknown }).results;
	if (!Array.isArray(batchResults)) return [{ name, ok: true }];
	return batchResults.map((entry) => {
		const item = entry as { name?: unknown; ok?: unknown; error?: unknown };
		const ok = item.ok === true;
		return {
			name: typeof item.name === "string" && item.name !== "" ? item.name : name,
			ok,
			...(ok ? {} : { detail: typeof item.error === "string" ? item.error : undefined }),
		};
	});
}

/**
 * Führt eine Chat-Runde inkl. aller angeforderten Werkzeugaufrufe aus.
 * Wirft ChatError (fachlich, UI-tauglich) oder AiClientError (Endpunkt).
 * `userRole` ist die Rolle aus der Session und bestimmt den Werkzeug-Scope
 * (normale Nutzer erhalten keine Administrations-Werkzeuge). `locale` ist
 * die gewählte App-Sprache (von der Chat-Route übergeben, Default Deutsch):
 * Systemprompt, modell-interne Hinweise und alle Fehlertexte folgen ihr.
 * Bewusst KEIN Import von @/lib/i18n/server (next/headers) - der
 * Übersetzer wird hier aus den reinen Dictionaries gebaut, damit die
 * Unit-Tests ohne Request-Kontext laufen.
 */
export async function runChat(input: {
	messages: ChatHistoryMessage[];
	attachments: ChatAttachmentInput[];
	userEmail: string;
	userRole: "ADMIN" | "USER";
	locale?: Locale;
}): Promise<ChatRunResult> {
	const t = createTranslator(getMessages(input.locale ?? DEFAULT_LOCALE));
	const config = getAiConfig();
	if (!config) {
		throw new ChatError(t("chat.route.notConfigured"));
	}
	const scope: McpToolScope = input.userRole === "ADMIN" ? "ADMIN" : "USER";

	// Anhänge serverseitig aufbereiten: Text-Inhalte werden der letzten
	// Nutzernachricht beigelegt, Bilder als eigene Vision-Content-Parts
	// (OpenAI-"image_url" mit Base64-Data-URL) - die wenigsten Endpunkte
	// akzeptieren Datei-Uploads direkt.
	let attachmentSection = "";
	const imageParts: { type: "image_url"; image_url: { url: string } }[] = [];
	for (const attachment of input.attachments) {
		let processed;
		try {
			processed = await processAttachment(attachment.name, attachment.dataBase64, t);
		} catch (error) {
			if (error instanceof AttachmentError) throw new ChatError(error.message);
			console.error("[ai] Anhang-Verarbeitung fehlgeschlagen:", error);
			throw new ChatError(t("chat.attach.processingFailed", { name: attachment.name }));
		}
		if (processed.kind === "image") {
			imageParts.push({ type: "image_url", image_url: { url: `data:${processed.mimeType};base64,${processed.dataBase64}` } });
		} else {
			attachmentSection += `\n\n${t("chat.attach.markerBegin", { name: attachment.name })}\n${processed.text}\n${t("chat.attach.markerEnd", { name: attachment.name })}`;
		}
	}

	const openAiMessages: OpenAiMessage[] = [{ role: "system", content: buildSystemPrompt(t, input.userEmail, scope) }];
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

	const tools = buildOpenAiTools(scope);
	const executed: ExecutedToolCall[] = [];

	for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
		const assistantMessage = await createChatCompletion(config, openAiMessages, tools, t);
		const requestedCalls = (assistantMessage.tool_calls ?? []).filter((call) => call.type === "function");

		if (requestedCalls.length === 0) {
			// Content-Parts kommen nur in Nutzernachrichten vor - die
			// Assistant-Antwort ist definitionsgemäß ein String (oder null).
			const reply = (typeof assistantMessage.content === "string" ? assistantMessage.content : "").trim();
			if (!reply) {
				throw new AiClientError(t("chat.client.emptyReply"));
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
				executed.push({ name: call.function.name, ok: false, detail: t("chat.system.toolInvalidArgsDetail") });
				openAiMessages.push({
					role: "tool",
					tool_call_id: call.id,
					content: t("chat.system.toolInvalidArgsMessage"),
				});
				continue;
			}
			try {
				const result = await callTool(call.function.name, args, scope);
				executed.push(...summarizeToolExecution(call.function.name, result));
				openAiMessages.push({
					role: "tool",
					tool_call_id: call.id,
					content: truncateToolResult(t, JSON.stringify(result ?? null, null, 2)),
				});
			} catch (error) {
				// Fachliche Fehler (Validierung, Sperren, nicht gefunden) gehen
				// als Tool-Ergebnis zurück ans Modell - es kann darauf reagieren
				// (korrigierter Aufruf oder Rückmeldung an den Nutzer).
				const detail = error instanceof McpToolError ? error.message : t("chat.system.toolInternalError");
				if (!(error instanceof McpToolError)) {
					console.error(`[ai] Werkzeug "${call.function.name}" fehlgeschlagen:`, error);
				}
				executed.push({ name: call.function.name, ok: false, detail });
				openAiMessages.push({ role: "tool", tool_call_id: call.id, content: t("chat.system.toolErrorPrefix", { detail }) });
			}
		}

		// Budget-Frühwarnung: einmalig ans Modell melden, wenn nur noch
		// wenige Runden übrig sind - es soll verbleibende Schritte bündeln
		// bzw. einen geordneten Zwischenstand vorbereiten, statt
		// unvorbereitet im Limit zu landen.
		const remainingRounds = MAX_TOOL_ROUNDS - 1 - round;
		if (remainingRounds === BUDGET_WARNING_REMAINING) {
			openAiMessages.push({
				role: "system",
				content: t("chat.budget.warning", { remaining: BUDGET_WARNING_REMAINING }),
			});
		}
	}

	// Budget erschöpft: KEIN harter Abbruch mehr - der bis dahin erreichte
	// Fortschritt (gerade bei Massenanlagen) wäre sonst komplett verloren.
	// Stattdessen Schlussrunde OHNE Werkzeugangebot: Das Modell fasst den
	// Zwischenstand zusammen und benennt die offenen Reste; der Nutzer kann
	// die Fortsetzung (z. B. mit "weiter") als neue Nachricht anstoßen.
	console.warn(`[ai] Werkzeug-Budget von ${MAX_TOOL_ROUNDS} Runden erschöpft - starte Schlussrunde ohne Werkzeuge.`);
	openAiMessages.push({
		role: "system",
		content: t("chat.budget.exhaustedNote"),
	});
	const finalMessage = await createChatCompletion(config, openAiMessages, undefined, t);
	const finalReply = (typeof finalMessage.content === "string" ? finalMessage.content : "").trim();
	if (finalReply) {
		return { reply: finalReply, toolCalls: executed };
	}

	// Fallback, falls das Modell auch in der Schlussrunde nichts liefert:
	// faktisch korrekte Bilanz aus den lokal vorliegenden Aufrufdaten.
	const failedCount = executed.filter((call) => !call.ok).length;
	return {
		reply: t("chat.budget.fallbackReply", { max: MAX_TOOL_ROUNDS, total: executed.length, failed: failedCount }),
		toolCalls: executed,
	};
}
