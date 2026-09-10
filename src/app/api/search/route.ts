import { NextResponse } from "next/server";

import { searchDatabase } from "@/data/search";
import { getCurrentUser } from "@/lib/auth/dal";
import { getT } from "@/lib/i18n/server";
import { MIN_SEARCH_QUERY_LENGTH, type SearchResponse } from "@/lib/search-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Globale Suche (Command-Palette, Cmd/Ctrl+K): durchsucht sämtliche
 * Fachdaten beider Bereiche. Die Datenbank-Suche selbst liegt im
 * Repository src/data/search.ts; hier nur Auth-Prüfung (JSON-401 statt
 * Redirect, da der Client per fetch aufruft - Muster wie /api/chat) und
 * Param-Validierung.
 *
 * Benutzerkonten (E-Mail-Adressen) durchsucht NUR die Rolle ADMIN - normale
 * Nutzer erhalten dafür schlicht keine Treffer dieser Art.
 */
export async function GET(request: Request) {
	// t() bewusst VOR try/catch aufrufen (benötigt den Request-Kontext), siehe /api/chat.
	const t = await getT();
	try {
		const user = await getCurrentUser();
		if (!user) {
			return NextResponse.json({ error: t("search.errors.unauthorized") }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const query = (searchParams.get("q") ?? "").trim();
		if (query.length < MIN_SEARCH_QUERY_LENGTH) {
			return NextResponse.json({ results: [] } satisfies SearchResponse);
		}

		const results = searchDatabase(query, { includeUsers: user.role === "ADMIN" });
		return NextResponse.json({ results } satisfies SearchResponse);
	} catch (error) {
		console.error("[search] Globale Suche fehlgeschlagen:", error);
		return NextResponse.json({ error: t("search.errors.failed") }, { status: 500 });
	}
}
