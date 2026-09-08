import type { AiConfig } from "./config";

/**
 * Minimaler Client für OpenAI-kompatible Chat-Completions-Endpunkte
 * (POST {baseUrl}/chat/completions) - bewusst nur natives fetch, kein SDK
 * (Muster wie src/lib/dropbox.ts): Der Endpunkt ist frei konfigurierbar
 * (OpenAI, kompatible Gateways, lokale Server wie LM Studio/Ollama), das
 * hier genutzte Subset (Messages + Function/Tool-Calling, nicht-streamend)
 * ist überall identisch.
 *
 * Fehler werden als AiClientError mit deutscher, UI-tauglicher Meldung
 * geworfen (keine Stack-Details nach außen - Details ins Server-Log).
 */

export class AiClientError extends Error {}

export interface OpenAiToolCall {
	id: string;
	type: "function";
	function: { name: string; arguments: string };
}

/** Content-Part einer Nachricht (OpenAI-Multimodal-Format). */
export type OpenAiContentPart =
	| { type: "text"; text: string }
	| { type: "image_url"; image_url: { url: string } };

export interface OpenAiMessage {
	role: "system" | "user" | "assistant" | "tool";
	/** String (Normalfall) oder Content-Part-Array (bei Nutzernachrichten mit Bildern). */
	content: string | null | OpenAiContentPart[];
	/** Nur bei role "assistant": vom Modell angeforderte Werkzeugaufrufe. */
	tool_calls?: OpenAiToolCall[];
	/** Nur bei role "tool": Bezug auf den beantworteten Werkzeugaufruf. */
	tool_call_id?: string;
}

export interface OpenAiTool {
	type: "function";
	function: {
		name: string;
		description: string;
		/** JSON-Schema (type "object") der Argumente. */
		parameters: Record<string, unknown>;
	};
}

/** Timeout pro Endpunkt-Aufruf (lokale Modelle können langsam sein). */
const REQUEST_TIMEOUT_MS = 180_000;

/**
 * Führt einen Chat-Completions-Request aus und liefert die
 * Assistant-Nachricht der ersten Choice (mit ggf. angeforderten Tool-Calls).
 */
export async function createChatCompletion(
	config: AiConfig,
	messages: OpenAiMessage[],
	tools: OpenAiTool[]
): Promise<OpenAiMessage> {
	const url = `${config.baseUrl}/chat/completions`;

	let response: Response;
	try {
		response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
			},
			body: JSON.stringify({
				model: config.model,
				messages,
				tools,
				tool_choice: "auto",
				stream: false,
			}),
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
	} catch (error) {
		console.error("[ai] Endpunkt nicht erreichbar:", error);
		throw new AiClientError(
			`Der KI-Endpunkt (${config.baseUrl}) ist nicht erreichbar. Bitte prüfen Sie die Konfiguration unter Einstellungen → KI-Assistent und ob der Dienst läuft.`
		);
	}

	if (!response.ok) {
		// OpenAI-kompatible Fehlerantworten tragen die Details meist in
		// error.message - für die UI aufbereiten, aber Länge begrenzen.
		let detail = "";
		try {
			const body = (await response.json()) as { error?: { message?: unknown } };
			if (typeof body.error?.message === "string") detail = body.error.message.slice(0, 300);
		} catch {
			// Kein JSON-Fehlerbody - dann bleibt es bei der Statusmeldung.
		}
		console.error(`[ai] Endpunkt meldet HTTP ${response.status}:`, detail || "(kein Fehler-Body)");
		const hint = response.status === 401 || response.status === 403 ? " (API-Schlüssel prüfen)" : response.status === 404 ? " (Basis-URL/Modell prüfen)" : "";
		throw new AiClientError(`Der KI-Endpunkt meldet HTTP ${response.status}${hint}.${detail ? ` Antwort: ${detail}` : ""}`);
	}

	let data: { choices?: { message?: OpenAiMessage }[] };
	try {
		data = (await response.json()) as typeof data;
	} catch {
		throw new AiClientError("Der KI-Endpunkt hat keine gültige JSON-Antwort geliefert.");
	}

	const message = data.choices?.[0]?.message;
	if (!message || typeof message !== "object") {
		console.error("[ai] Unerwartetes Antwortformat:", JSON.stringify(data).slice(0, 500));
		throw new AiClientError("Der KI-Endpunkt hat ein unerwartetes Antwortformat geliefert (keine choices[0].message).");
	}
	return message;
}
