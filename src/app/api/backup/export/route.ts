import { NextResponse } from "next/server";

import { createBackupZipStream, exportBackup } from "@/data/backup";
import { requireAdmin } from "@/lib/auth/dal";

/**
 * Backup-Export (vollständige Anwendungsdaten: data.db + files/ + manifest
 * mit SHA-256-Prüfsummen, siehe src/data/backup.ts).
 *
 * - GET: Streaming-Download der ZIP (Browser-Fallback/Dev-Modus ohne
 *   Electron-Dateidialog).
 * - POST { targetPath }: schreibt die ZIP in einen lokalen Pfad (Aufruf aus
 *   der Desktop-App heraus, nachdem der Nutzer den Zielort im nativen
 *   Dateidialog gewählt hat).
 *
 * Nur für Admins (requireAdmin() leitet andernfalls um) - das Backup
 * enthält u. a. die komplette Nutzerverwaltung sowie alle personenbezogenen
 * Mieter-/Eigentümerdaten.
 */
export async function GET() {
	await requireAdmin();

	const { stream, fileName } = await createBackupZipStream();

	// Node-Stream -> Web-Stream für die Response.
	const webStream = new ReadableStream({
		start(controller) {
			stream.on("data", (chunk) => controller.enqueue(chunk));
			stream.on("end", () => controller.close());
			stream.on("error", (error) => controller.error(error));
		},
	});

	return new NextResponse(webStream, {
		status: 200,
		headers: {
			"Content-Type": "application/zip",
			"Content-Disposition": `attachment; filename="${fileName}"`,
			"Cache-Control": "no-store",
		},
	});
}

export async function POST(request: Request) {
	await requireAdmin();

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
	}

	const targetPath = typeof (body as { targetPath?: unknown })?.targetPath === "string" ? (body as { targetPath: string }).targetPath : null;
	if (!targetPath) {
		return NextResponse.json({ error: "Zielpfad fehlt." }, { status: 400 });
	}

	try {
		const result = await exportBackup(targetPath);
		return NextResponse.json({ ok: true, ...result });
	} catch (error) {
		console.error("Backup-Export fehlgeschlagen", error);
		return NextResponse.json(
			{ error: `Export fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}` },
			{ status: 500 }
		);
	}
}
