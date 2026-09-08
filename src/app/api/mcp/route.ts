import { NextResponse } from "next/server";

import { isMcpEnabled, isValidMcpToken } from "@/lib/mcp/auth";
import { handleMcpPost, internalErrorBody } from "@/lib/mcp/protocol";

// Registriert alle MCP-Werkzeuge (Seiteneffekt des Imports).
import "@/lib/mcp/tools";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * MCP-Endpunkt (Model Context Protocol, "Streamable HTTP" im einfachen
 * Request/Response-Modus): Ermöglicht KI-Clients den vollständigen
 * Lese-/Schreibzugriff auf die Fachdaten der Anwendung (CRUD über den
 * Repository-Layer, siehe src/lib/mcp/).
 *
 * Sicherheitsmodell:
 * - Der Endpunkt ist standardmäßig DEAKTIVIERT und wird vom Admin unter
 *   Einstellungen → MCP-Server (KI-Zugriff) aktiviert.
 * - Authentifizierung ausschließlich über ein Bearer-Token
 *   (Authorization-Header oder access_token-Query-Parameter), KEIN
 *   Session-Cookie. Der Auth-Proxy (src/proxy.ts) lässt /api/mcp daher
 *   ohne Cookie durch - die Token-Prüfung hier ist die autoritative
 *   Schranke. Das Token wird feldverschlüsselt in app_settings abgelegt
 *   (src/lib/mcp/auth.ts) und hat faktisch Admin-Rechte.
 * - Zusätzlich gilt im Host-Modus (LAN) der Token-Check des
 *   Electron-Main-Proxys (electron/main/server.ts).
 */

function extractToken(request: Request): string | null {
	const authorization = request.headers.get("authorization");
	if (authorization) {
		const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
		if (match) return match[1].trim();
	}
	// Fallback für Clients ohne Header-Steuerung (RFC 6750, URI Query Parameter).
	return new URL(request.url).searchParams.get("access_token");
}

export async function POST(request: Request) {
	if (!isMcpEnabled()) {
		return NextResponse.json(
			{ error: "Der MCP-Server ist deaktiviert. Aktivierung: Einstellungen → MCP-Server (KI-Zugriff)." },
			{ status: 403 }
		);
	}

	if (!isValidMcpToken(extractToken(request))) {
		return NextResponse.json({ error: "Ungültiges oder fehlendes Zugriffs-Token." }, { status: 401 });
	}

	try {
		const result = await handleMcpPost(await request.text());
		if (result.status === 202) {
			return new Response(null, { status: 202 });
		}
		return NextResponse.json(result.body, { status: result.status });
	} catch (error) {
		console.error("MCP-Endpunkt fehlgeschlagen:", error);
		return NextResponse.json(internalErrorBody(), { status: 500 });
	}
}

/** Der Endpunkt bietet keinen SSE-Stream - GET ist nicht vorgesehen. */
export async function GET() {
	return NextResponse.json(
		{
			error: "Method Not Allowed",
			hint: "Dies ist der ImmoBase-MCP-Endpunkt (Model Context Protocol). Clients kommunizieren per POST mit JSON-RPC-2.0-Nachrichten.",
		},
		{ status: 405, headers: { Allow: "POST" } }
	);
}
