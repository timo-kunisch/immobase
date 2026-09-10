import { deMessages } from "@/lib/i18n/messages/de";
import { createTranslator, type TranslateFn } from "@/lib/i18n/translator";

import type { AiConfig } from "./config";

/**
 * Minimaler Client für OpenAI-kompatible Chat-Completions-Endpunkte
 * (POST {baseUrl}/chat/completions) - bewusst nur natives fetch, kein SDK
 * (Muster wie src/lib/dropbox.ts): Der Endpunkt ist frei konfigurierbar
 * (OpenAI, kompatible Gateways, lokale Server wie LM Studio/Ollama), das
 * hier genutzte Subset (Messages + Function/Tool-Calling, nicht-streamend)
 * ist überall identisch.
 *
 * Fehler werden als AiClientError mit UI-tauglicher Meldung in der Sprache
 * des übergebenen Übersetzers geworfen (Default: Deutsch - der Chat in
 * src/lib/ai/chat.ts übergibt die gewählte App-Sprache; keine Stack-Details
 * nach außen - Details ins Server-Log).
 */

/**
 * Standard-Übersetzer (Deutsch) für Aufrufe ohne eigenen t()-Parameter -
 * u. a. die Unit-Tests, die ohne next/headers-Kontext laufen.
 */
const defaultT = createTranslator(deMessages);

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
 * Wiederholbare Antwort-Status: 408/429 (Timeout/Rate-Limit) und 5xx -
 * insbesondere 524 ("A Timeout Occurred" bei Endpunkten hinter Cloudflare):
 * Da die Anfragen nicht-streamend sind, sendet der Ursprungsserver bis zum
 * Abschluss der Generierung keinerlei Daten - dauert sie zu lange, bricht
 * die vorgeschaltete Schicht (Cloudflare nach ~100 s) mit 524 ab. Ein
 * erneuter Versuch geht dann häufig durch (warmes Modell, frei gewordene
 * Kapazität). Muster wie fetchWithRetry in src/lib/dropbox.ts.
 */
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504, 524]);
const MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Führt einen Chat-Completions-Request aus und liefert die
 * Assistant-Nachricht der ersten Choice (mit ggf. angeforderten Tool-Calls).
 * Vorübergehende Fehler (Netzwerkfehler, eigener Timeout, RETRYABLE_STATUS)
 * werden mit einfachem Backoff wiederholt (Retry-After-Header wird
 * beachtet) - Chat-Completions sind reine Anfragen ohne Seiteneffekte,
 * Wiederholungen sind daher sicher.
 */
export async function createChatCompletion(
	config: AiConfig,
	messages: OpenAiMessage[],
	tools?: OpenAiTool[],
	t: TranslateFn = defaultT
): Promise<OpenAiMessage> {
	const url = `${config.baseUrl}/chat/completions`;
	// Ohne übergebene Werkzeuge werden die Felder tools/tool_choice komplett
	// weggelassen (statt tools: []) - so KANN das Modell keine Aufrufe mehr
	// anfordern (genutzt für die Schlussrunde nach Budget-Erschöpfung, siehe
	// chat.ts); das ist bei den kompatiblen Endpunkten portabler als ein
	// leeres Werkzeug-Array oder tool_choice "none".
	const body: Record<string, unknown> = {
		model: config.model,
		messages,
		stream: false,
	};
	if (tools && tools.length > 0) {
		body.tools = tools;
		body.tool_choice = "auto";
	}
	// Header/Body einmal aufbauen: Der String-Body ist über die Versuche
	// hinweg wiederverwendbar (kein Stream). Das AbortSignal muss dagegen
	// pro Versuch FRISCH erzeugt werden - ein abgelaufenes Signal würde
	// jeden Folgeversuch sofort abbrechen.
	const init: RequestInit = {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
		},
		body: JSON.stringify(body),
	};

	let response: Response | null = null;
	let lastNetworkError: unknown = null;
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		try {
			response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
		} catch (error) {
			response = null;
			lastNetworkError = error;
		}
		const retryable = response === null || RETRYABLE_STATUS.has(response.status);
		if (!retryable || attempt === MAX_ATTEMPTS) break;

		const retryAfterSeconds = response ? Number(response.headers.get("retry-after") ?? "") : Number.NaN;
		const waitMs =
			Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? Math.min(retryAfterSeconds * 1000, 30_000) : 1000 * attempt;
		console.warn(
			`[ai] Endpunkt-Aufruf fehlgeschlagen (Versuch ${attempt}/${MAX_ATTEMPTS}${response ? `, HTTP ${response.status}` : ""}) - wiederhole in ${waitMs} ms.`,
			response === null ? lastNetworkError : ""
		);
		await sleep(waitMs);
	}

	if (response === null) {
		console.error("[ai] Endpunkt nicht erreichbar:", lastNetworkError);
		throw new AiClientError(t("chat.client.unreachable", { baseUrl: config.baseUrl }));
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
		const hint =
			response.status === 401 || response.status === 403
				? t("chat.client.hintAuth")
				: response.status === 404
					? t("chat.client.hintNotFound")
					: response.status === 504 || response.status === 524
						? t("chat.client.hintTimeout")
						: "";
		throw new AiClientError(
			t("chat.client.httpError", { status: response.status, hint }) + (detail ? t("chat.client.httpErrorDetail", { detail }) : "")
		);
	}

	let data: { choices?: { message?: OpenAiMessage }[] };
	try {
		data = (await response.json()) as typeof data;
	} catch {
		throw new AiClientError(t("chat.client.invalidJson"));
	}

	const message = data.choices?.[0]?.message;
	if (!message || typeof message !== "object") {
		console.error("[ai] Unerwartetes Antwortformat:", JSON.stringify(data).slice(0, 500));
		throw new AiClientError(t("chat.client.unexpectedFormat"));
	}
	return message;
}
