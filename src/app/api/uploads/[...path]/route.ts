import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/dal";
import { getMimeType, getUploadedFile } from "@/lib/storage";

/**
 * Liefert eine zuvor über die Dokumente-/Vorlagen-Uploads im R2-Objektspeicher
 * abgelegte Datei aus. Der Bucket selbst ist NICHT öffentlich lesbar - diese
 * Route ist der einzige Weg, an eine Datei zu kommen.
 *
 * Schutz zweifach abgesichert (wie alle Requests läuft diese Route auch
 * durch src/proxy.ts, das nur den optimistischen Cookie-Check macht): hier
 * zusätzlich ein autoritativer requireUser()-Check gegen die DB, da das
 * Ausliefern von Dateien sicherheitsrelevant ist und nicht allein auf den
 * Middleware-Schutz vertrauen soll.
 *
 * URL-Schema: /api/uploads/<subdir>/<dateiname>
 */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
	await requireUser();

	const { path: segments } = await params;
	const relativePath = segments.join("/");

	const file = await getUploadedFile(relativePath);
	if (!file) {
		return NextResponse.json({ error: "Datei nicht gefunden." }, { status: 404 });
	}

	const fileName = file.fileName;
	const mimeType = file.mimeType || getMimeType(fileName);

	// Bilder & PDFs im Browser anzeigen, alles andere zum Download anbieten.
	const isInlinePreviewable = mimeType.startsWith("image/") || mimeType === "application/pdf";

	// ASCII-Fallback (filename=) für ältere Clients + RFC-5987-kodierte Variante
	// (filename*=) für korrekte Umlaute/Sonderzeichen im Original-Dateinamen.
	const asciiFallbackName = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
	const contentDisposition = `${isInlinePreviewable ? "inline" : "attachment"}; filename="${asciiFallbackName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;

	return new NextResponse(file.body, {
		status: 200,
		headers: {
			"Content-Type": mimeType,
			"Content-Disposition": contentDisposition,
			"Cache-Control": "private, max-age=0, must-revalidate",
		},
	});
}
