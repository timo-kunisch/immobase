import { NextResponse } from "next/server";

import { MAX_ATTACHMENTS_PER_MESSAGE, MAX_ATTACHMENT_BASE64_CHARS } from "@/lib/ai/attachment-types";
import { runChat, ChatError, type ChatAttachmentInput, type ChatHistoryMessage } from "@/lib/ai/chat";
import { AiClientError } from "@/lib/ai/client";
import { isAiConfigured } from "@/lib/ai/config";
import { getCurrentUser } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Chat-Endpunkt des KI-Assistenten (Sprechblase in der Sidebar, siehe
 * src/components/layout/chatbot-dialog.tsx).
 *
 * Sicherheitsmodell: Session-Authentifizierung über den Auth-Proxy
 * (src/proxy.ts, Cookie-Check) + autoritative Prüfung hier. Der Chat steht
 * ALLEN angemeldeten Nutzern offen; die Rolle des Nutzers bestimmt den
 * Werkzeug-Scope (src/lib/mcp/registry.ts): Normale Nutzer erhalten nur
 * die fachlichen Werkzeuge (wie in der App-Oberfläche), Administrations-
 * Werkzeuge (Nutzerverwaltung, Absenderdaten) bleiben Administratoren
 * vorbehalten. getCurrentUser() statt requireUser(), damit die Ablehnung
 * als sauberes JSON (401) statt als HTML-Redirect an den fetch-Client geht.
 */

const MAX_MESSAGES = 50;
const MAX_MESSAGE_CHARS = 20_000;

interface ParsedBody {
	messages: ChatHistoryMessage[];
	attachments: ChatAttachmentInput[];
}

function parseBody(body: unknown): ParsedBody | string {
	if (typeof body !== "object" || body === null) return "Der Request-Body muss ein JSON-Objekt sein.";
	const { messages, attachments } = body as { messages?: unknown; attachments?: unknown };

	if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
		return `Erwartet werden 1 bis ${MAX_MESSAGES} Nachrichten.`;
	}
	const parsedMessages: ChatHistoryMessage[] = [];
	for (const message of messages) {
		if (typeof message !== "object" || message === null) return "Ungültiges Nachrichtenformat.";
		const { role, content } = message as { role?: unknown; content?: unknown };
		if (role !== "user" && role !== "assistant") return 'Nachrichten müssen die Rolle "user" oder "assistant" haben.';
		if (typeof content !== "string" || content.trim() === "" || content.length > MAX_MESSAGE_CHARS) {
			return `Nachrichten müssen nicht-leere Texte mit höchstens ${MAX_MESSAGE_CHARS} Zeichen sein.`;
		}
		parsedMessages.push({ role, content });
	}
	if (parsedMessages[parsedMessages.length - 1].role !== "user") {
		return "Die letzte Nachricht muss vom Nutzer stammen.";
	}

	const parsedAttachments: ChatAttachmentInput[] = [];
	if (attachments !== undefined) {
		if (!Array.isArray(attachments) || attachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
			return `Erwartet werden höchstens ${MAX_ATTACHMENTS_PER_MESSAGE} Datei-Anhänge.`;
		}
		for (const attachment of attachments) {
			if (typeof attachment !== "object" || attachment === null) return "Ungültiges Anhang-Format.";
			const { name, dataBase64 } = attachment as { name?: unknown; dataBase64?: unknown };
			if (typeof name !== "string" || name.trim() === "" || name.length > 255) return "Ungültiger Dateiname im Anhang.";
			if (typeof dataBase64 !== "string" || dataBase64.length === 0 || dataBase64.length > MAX_ATTACHMENT_BASE64_CHARS) {
				return `Der Anhang "${name}" ist zu groß oder beschädigt.`;
			}
			parsedAttachments.push({ name: name.trim(), dataBase64 });
		}
		// Anhänge gehören fachlich zur letzten Nutzernachricht - ohne sie ergeben sie keinen Sinn.
		if (parsedAttachments.length > 0 && parsedMessages[parsedMessages.length - 1].role !== "user") {
			return "Datei-Anhänge sind nur zusammen mit einer Nutzernachricht erlaubt.";
		}
	}

	return { messages: parsedMessages, attachments: parsedAttachments };
}

export async function POST(request: Request) {
	// Äußerer Catch-All: Diese Route liefert IMMER JSON (auch bei
	// unerwarteten Fehlern in Auth-/DB-Zugriffen) - der Chat-Client zeigt
	// die Meldung direkt an; eine HTML-Fehlerseite von Next wäre dort nur
	// als kryptischer JSON-Parse-Fehler sichtbar.
	try {
		const user = await getCurrentUser();
		if (!user) {
			return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
		}

		if (!isAiConfigured()) {
			return NextResponse.json(
				{ error: "Es ist kein KI-Endpunkt konfiguriert. Einrichtung: Einstellungen → KI-Assistent." },
				{ status: 503 }
			);
		}

		let rawBody: unknown;
		try {
			rawBody = await request.json();
		} catch {
			return NextResponse.json({ error: "Der Request-Body ist kein gültiges JSON." }, { status: 400 });
		}

		const parsed = parseBody(rawBody);
		if (typeof parsed === "string") {
			return NextResponse.json({ error: parsed }, { status: 400 });
		}

		try {
			const result = await runChat({
				messages: parsed.messages,
				attachments: parsed.attachments,
				userEmail: user.email,
				userRole: user.role,
			});
			return NextResponse.json(result);
		} catch (error) {
			if (error instanceof ChatError || error instanceof AiClientError) {
				return NextResponse.json({ error: error.message }, { status: 502 });
			}
			console.error("[ai] Chat-Endpunkt fehlgeschlagen:", error);
			return NextResponse.json({ error: "Interner Fehler bei der Verarbeitung (Details im Server-Log)." }, { status: 500 });
		}
	} catch (error) {
		console.error("[ai] Unerwarteter Fehler im Chat-Endpunkt:", error);
		return NextResponse.json({ error: "Interner Serverfehler im Chat-Endpunkt (Details im Server-Log)." }, { status: 500 });
	}
}
