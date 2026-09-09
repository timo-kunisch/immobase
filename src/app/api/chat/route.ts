import { NextResponse } from "next/server";

import { MAX_ATTACHMENTS_PER_MESSAGE, MAX_ATTACHMENT_BASE64_CHARS } from "@/lib/ai/attachment-types";
import { runChat, ChatError, type ChatAttachmentInput } from "@/lib/ai/chat";
import { AiClientError } from "@/lib/ai/client";
import { isAiConfigured } from "@/lib/ai/config";
import { getCurrentUser } from "@/lib/auth/dal";
import { appendChatMessages, listChatMessages } from "@/data/chat-messages";

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
 *
 * Gesprächsverlauf: Der Verlauf liegt serverseitig pro Nutzer in der
 * Tabelle chat_messages (src/data/chat-messages.ts) und bleibt bis zum
 * manuellen Löschen im Dialog erhalten (DELETE /api/chat/history). Der
 * Client sendet daher nur die NEUE Nachricht; diese Route lädt den
 * bisherigen Verlauf, reicht ihn vollständig an den KI-Endpunkt weiter
 * und persistiert Nutzerfrage + Assistenten-Antwort nach erfolgreichem
 * Durchlauf. Bewusst KEINE serverseitige Längenkappung des Verlaufs -
 * der Verlauf soll vollständig erhalten bleiben; auf den damit
 * steigenden Token-Verbrauch weist eine Größen-Warnung im Dialog hin.
 */

const MAX_MESSAGE_CHARS = 20_000;

interface ParsedBody {
	message: string;
	attachments: ChatAttachmentInput[];
}

function parseBody(body: unknown): ParsedBody | string {
	if (typeof body !== "object" || body === null) return "Der Request-Body muss ein JSON-Objekt sein.";
	const { message, attachments } = body as { message?: unknown; attachments?: unknown };

	if (typeof message !== "string" || message.trim() === "" || message.length > MAX_MESSAGE_CHARS) {
		return `Erwartet wird eine nicht-leere Nachricht mit höchstens ${MAX_MESSAGE_CHARS} Zeichen.`;
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
	}

	return { message: message.trim(), attachments: parsedAttachments };
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
			// Gespeicherter Verlauf + die neue Nutzernachricht bilden den
			// Kontext für den KI-Endpunkt.
			const history = listChatMessages(user.id).map(({ role, content }) => ({ role, content }));
			const result = await runChat({
				messages: [...history, { role: "user", content: parsed.message }],
				attachments: parsed.attachments,
				userEmail: user.email,
				userRole: user.role,
			});
			// Erst nach erfolgreichem Durchlauf persistieren: Nutzerfrage und
			// Assistenten-Antwort gehören zusammen (eine Transaktion).
			appendChatMessages(user.id, [
				{ role: "user", content: parsed.message },
				{ role: "assistant", content: result.reply, toolCalls: result.toolCalls.map(({ name, ok }) => ({ name, ok })) },
			]);
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
