import { NextResponse } from "next/server";

import { clearChatMessages, listChatMessages } from "@/data/chat-messages";
import { getCurrentUser } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Persistenter Chat-Verlauf des KI-Assistenten (pro Nutzer, Tabelle
 * chat_messages über src/data/chat-messages.ts):
 * - GET: liefert den gespeicherten Verlauf (beim Öffnen des Dialogs).
 * - DELETE: löscht ihn vollständig (manueller Reset im Dialog -
 *   Papierkorb-Button bzw. die Größen-Warnung).
 *
 * Wie der Chat-Endpunkt (/api/chat) mit getCurrentUser() statt
 * requireUser(), damit Ablehnungen als JSON (401) statt als HTML-Redirect
 * an den fetch-Client gehen. Der Verlauf ist bewusst auch ohne
 * konfigurierten KI-Endpunkt les-/löschbar (persönliche Daten des
 * Nutzers).
 */

export async function GET() {
	try {
		const user = await getCurrentUser();
		if (!user) {
			return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
		}
		return NextResponse.json({ messages: listChatMessages(user.id) });
	} catch (error) {
		console.error("[ai] Chat-Verlauf konnte nicht geladen werden:", error);
		return NextResponse.json({ error: "Der Chat-Verlauf konnte nicht geladen werden (Details im Server-Log)." }, { status: 500 });
	}
}

export async function DELETE() {
	try {
		const user = await getCurrentUser();
		if (!user) {
			return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
		}
		clearChatMessages(user.id);
		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("[ai] Chat-Verlauf konnte nicht gelöscht werden:", error);
		return NextResponse.json({ error: "Der Chat-Verlauf konnte nicht gelöscht werden (Details im Server-Log)." }, { status: 500 });
	}
}
