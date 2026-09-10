import { NextResponse } from "next/server";

import { importBackup } from "@/data/backup";
import { requireAdmin } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { getT } from "@/lib/i18n/server";

/**
 * Backup-Import (Ersetzen oder Zusammenführen, siehe src/data/backup.ts).
 * Der Pfad zur Sicherungsdatei (ZIP oder verschlüsselter `.imbak`-Container)
 * wird aus der Desktop-App übergeben (nativer Dateidialog im Electron-
 * Main-Prozess); der eigentliche Import läuft hier serverseitig (dort liegt
 * die aktive Datenbankverbindung). Bei verschlüsselten Dateien ist das
 * Feld `password` Pflicht.
 *
 * Nur für Admins.
 */
export async function POST(request: Request) {
	const admin = await requireAdmin();
	const t = await getT();

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: t("settings.backup.errors.invalidRequest") }, { status: 400 });
	}

	const path = typeof (body as { path?: unknown })?.path === "string" ? (body as { path: string }).path : null;
	const mode = (body as { mode?: unknown })?.mode === "merge" ? ("merge" as const) : ("replace" as const);
	const password =
		typeof (body as { password?: unknown })?.password === "string" && (body as { password: string }).password.length > 0
			? (body as { password: string }).password
			: undefined;
	if (!path) {
		return NextResponse.json({ error: t("settings.backup.errors.pathMissing") }, { status: 400 });
	}

	try {
		const result = await importBackup(path, mode, password !== undefined ? { password } : undefined);
		// Der Eintrag landet bewusst im importierten Datenbestand (der Import
		// hat die DB-Verbindung ersetzt) - so ist auch dort nachvollziehbar,
		// dass dieser Stand aus einer Sicherung wiederhergestellt wurde.
		logActivity(
			admin,
			"CREATE",
			"system",
			`Datensicherung importiert (${mode === "merge" ? "zusammengeführt" : "ersetzt"}, ${result.importedFiles} Dateien)`
		);
		return NextResponse.json({ ok: true, ...result });
	} catch (error) {
		console.error("Backup-Import fehlgeschlagen", error);
		return NextResponse.json(
			{ error: t("settings.backup.errors.importFailed", { error: error instanceof Error ? error.message : String(error) }) },
			{ status: 400 }
		);
	}
}
