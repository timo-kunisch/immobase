import { NextResponse } from "next/server";

import { clearChatMessages, listChatMessages } from "@/data/chat-messages";
import { getCurrentUser } from "@/lib/auth/dal";
import { getT } from "@/lib/i18n/server";

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
	const t = await getT();
	try {
		const user = await getCurrentUser();
		if (!user) {
			return NextResponse.json({ error: t("chat.route.unauthorized") }, { status: 401 });
		}
		return NextResponse.json({ messages: listChatMessages(user.id) });
	} catch (error) {
		console.error("[ai] Chat-Verlauf konnte nicht geladen werden:", error);
		return NextResponse.json({ error: t("chat.route.historyLoadFailed") }, { status: 500 });
	}
}

export async function DELETE() {
	const t = await getT();
	try {
		const user = await getCurrentUser();
		if (!user) {
			return NextResponse.json({ error: t("chat.route.unauthorized") }, { status: 401 });
		}
		clearChatMessages(user.id);
		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("[ai] Chat-Verlauf konnte nicht gelöscht werden:", error);
		return NextResponse.json({ error: t("chat.route.historyDeleteFailed") }, { status: 500 });
	}
}
