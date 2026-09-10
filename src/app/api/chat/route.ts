import { NextResponse } from "next/server";

import { MAX_ATTACHMENTS_PER_MESSAGE, MAX_ATTACHMENT_BASE64_CHARS } from "@/lib/ai/attachment-types";
import { CHAT_HISTORY_HARD_LIMIT_CHARS } from "@/lib/ai/chat-limits";
import { runChat, ChatError, type ChatAttachmentInput } from "@/lib/ai/chat";
import { AiClientError } from "@/lib/ai/client";
import { isAiConfigured } from "@/lib/ai/config";
import { getCurrentUser } from "@/lib/auth/dal";
import { getLocale, getT } from "@/lib/i18n/server";
import type { MessageKey, TranslateParams } from "@/lib/i18n/translator";
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
 * Durchlauf. Scheitert der Durchlauf, werden stattdessen Nutzerfrage +
 * Fehlermeldung (Rolle "error") persistiert - Fehler bleiben so als
 * farblich markierte Nachricht im Verlauf nachvollziehbar, bis der
 * Verlauf gelöscht wird. Bewusst KEINE serverseitige Längenkappung des
 * Verlaufs, aber eine HARTE Obergrenze: Ab CHAT_HISTORY_HARD_LIMIT_CHARS
 * Zeichen (Verlauf + neue Nachricht) werden weitere Nachrichten mit
 * HTTP 413 abgelehnt, bis der Verlauf gelöscht wird; auf den steigenden
 * Token-Verbrauch weist vorab eine Größen-Warnung im Dialog hin.
 */

const MAX_MESSAGE_CHARS = 20_000;

interface ParsedBody {
	message: string;
	attachments: ChatAttachmentInput[];
}

// Validierungsfehler werden als Übersetzungsschlüssel + Parameter
// zurückgegeben und erst im Handler in der Sprache des Nutzers aufgelöst.
type BodyError = { key: MessageKey; params?: TranslateParams };

function parseBody(body: unknown): ParsedBody | BodyError {
	if (typeof body !== "object" || body === null) return { key: "chat.route.bodyNotObject" };
	const { message, attachments } = body as { message?: unknown; attachments?: unknown };

	if (typeof message !== "string" || message.trim() === "" || message.length > MAX_MESSAGE_CHARS) {
		return { key: "chat.route.messageInvalid", params: { max: MAX_MESSAGE_CHARS } };
	}

	const parsedAttachments: ChatAttachmentInput[] = [];
	if (attachments !== undefined) {
		if (!Array.isArray(attachments) || attachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
			return { key: "chat.route.attachmentsTooMany", params: { max: MAX_ATTACHMENTS_PER_MESSAGE } };
		}
		for (const attachment of attachments) {
			if (typeof attachment !== "object" || attachment === null) return { key: "chat.route.attachmentInvalid" };
			const { name, dataBase64 } = attachment as { name?: unknown; dataBase64?: unknown };
			if (typeof name !== "string" || name.trim() === "" || name.length > 255) return { key: "chat.route.attachmentNameInvalid" };
			if (typeof dataBase64 !== "string" || dataBase64.length === 0 || dataBase64.length > MAX_ATTACHMENT_BASE64_CHARS) {
				return { key: "chat.route.attachmentTooLarge", params: { name: String(name) } };
			}
			parsedAttachments.push({ name: name.trim(), dataBase64 });
		}
	}

	return { message: message.trim(), attachments: parsedAttachments };
}

function isBodyError(parsed: ParsedBody | BodyError): parsed is BodyError {
	return "key" in parsed;
}

export async function POST(request: Request) {
	// Äußerer Catch-All: Diese Route liefert IMMER JSON (auch bei
	// unerwarteten Fehlern in Auth-/DB-Zugriffen) - der Chat-Client zeigt
	// die Meldung direkt an; eine HTML-Fehlerseite von Next wäre dort nur
	// als kryptischer JSON-Parse-Fehler sichtbar.
	// getT() steht bewusst VOR dem try: ohne Übersetzer könnte auch der
	// Catch-All keine lokalisierte Meldung liefern; ein Fehler hier würde
	// ohnehin nur beim Cookie-Zugriff auftreten (Request-Kontext liegt vor).
	// Die Locale geht zusätzlich an runChat, damit Systemprompt und die
	// Fehlertexte des KI-Stacks derselben Sprache folgen.
	const t = await getT();
	const locale = await getLocale();
	try {
		const user = await getCurrentUser();
		if (!user) {
			return NextResponse.json({ error: t("chat.route.unauthorized") }, { status: 401 });
		}

		if (!isAiConfigured()) {
			return NextResponse.json({ error: t("chat.route.notConfigured") }, { status: 503 });
		}

		let rawBody: unknown;
		try {
			rawBody = await request.json();
		} catch {
			return NextResponse.json({ error: t("chat.route.invalidJson") }, { status: 400 });
		}

		const parsed = parseBody(rawBody);
		if (isBodyError(parsed)) {
			return NextResponse.json({ error: t(parsed.key, parsed.params) }, { status: 400 });
		}

		// Harte Obergrenze des Verlaufs (Verlauf + neue Nachricht): Ab hier
		// wird abgebrochen, bis der Verlauf gelöscht wird - der komplette
		// Verlauf fließt bei jeder Anfrage in den KI-Kontext.
		const storedHistory = listChatMessages(user.id);
		const totalHistoryChars = storedHistory.reduce((sum, entry) => sum + entry.content.length, 0) + parsed.message.length;
		if (totalHistoryChars >= CHAT_HISTORY_HARD_LIMIT_CHARS) {
			return NextResponse.json(
				{
					error: t("chat.route.hardLimit", { max: new Intl.NumberFormat("de-DE").format(CHAT_HISTORY_HARD_LIMIT_CHARS) }),
				},
				{ status: 413 }
			);
		}

		try {
			// Gespeicherter Verlauf + die neue Nutzernachricht bilden den
			// Kontext für den KI-Endpunkt. Fehler-Einträge (Rolle "error")
			// werden dem Modell als markierte Assistenten-Notiz mitgegeben,
			// damit es fehlgeschlagene Versuche kennt.
			const history = storedHistory.map(({ role, content }) =>
				role === "error"
					? { role: "assistant" as const, content: `(Diese Anfrage ist fehlgeschlagen: ${content})` }
					: { role, content }
			);
			const result = await runChat({
				messages: [...history, { role: "user", content: parsed.message }],
				attachments: parsed.attachments,
				userEmail: user.email,
				userRole: user.role,
				locale,
			});
			// Erst nach erfolgreichem Durchlauf persistieren: Nutzerfrage und
			// Assistenten-Antwort gehören zusammen (eine Transaktion).
			appendChatMessages(user.id, [
				{ role: "user", content: parsed.message },
				{ role: "assistant", content: result.reply, toolCalls: result.toolCalls.map(({ name, ok }) => ({ name, ok })) },
			]);
			return NextResponse.json(result);
		} catch (error) {
			const isKnownError = error instanceof ChatError || error instanceof AiClientError;
			const message = isKnownError ? error.message : t("chat.route.internalError");
			if (!isKnownError) {
				console.error("[ai] Chat-Endpunkt fehlgeschlagen:", error);
			}
			// Den Fehlschlag im Verlauf festhalten: Nutzerfrage + Fehlermeldung
			// (Rolle "error"), damit der Fehler im Dialog als Nachricht an
			// dieser Stelle nachvollziehbar bleibt. Best-effort - ein
			// Persistenzfehler darf die eigentliche Fehlermeldung nicht
			// verdecken.
			try {
				appendChatMessages(user.id, [
					{ role: "user", content: parsed.message },
					{ role: "error", content: message },
				]);
			} catch (persistError) {
				console.error("[ai] Fehlgeschlagene Chat-Runde konnte nicht im Verlauf gespeichert werden:", persistError);
			}
			return NextResponse.json({ error: message }, { status: isKnownError ? 502 : 500 });
		}
	} catch (error) {
		console.error("[ai] Unerwarteter Fehler im Chat-Endpunkt:", error);
		return NextResponse.json({ error: t("chat.route.serverError") }, { status: 500 });
	}
}
