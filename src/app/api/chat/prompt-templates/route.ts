import { NextResponse } from "next/server";

import {
	countPromptTemplates,
	createPromptTemplate,
	deletePromptTemplate,
	listPromptTemplates,
	updatePromptTemplate,
} from "@/data/prompt-templates";
import type { PromptTemplate } from "@/data/types";
import {
	MAX_PROMPT_TEMPLATE_CONTENT_CHARS,
	MAX_PROMPT_TEMPLATE_TITLE_CHARS,
	MAX_PROMPT_TEMPLATES_PER_USER,
} from "@/lib/ai/prompt-templates";
import { getCurrentUser } from "@/lib/auth/dal";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Eigene Prompt-Vorlagen des angemeldeten Nutzers für den KI-Assistenten
 * (Tabelle prompt_templates über src/data/prompt-templates.ts):
 * - GET: listet die eigenen Vorlagen (das Panel ergänzt die Werk-Vorlagen
 *   clientseitig aus src/lib/ai/prompt-templates.ts).
 * - POST: legt eine Vorlage an ({title, content}).
 * - PUT: aktualisiert eine Vorlage ({id, title, content}).
 * - DELETE: löscht eine Vorlage (?id=…).
 *
 * Wie die übrigen Chat-Routen mit getCurrentUser() statt requireUser(),
 * damit Ablehnungen als JSON (401) statt als HTML-Redirect an den
 * fetch-Client gehen. Alle Repository-Aufrufe sind auf die user_id des
 * Angemeldeten eingeschränkt - fremde Vorlagen sind weder lesbar noch
 * veränderbar (404 statt 403, damit keine Existenz verraten wird).
 * Die Vorlagen sind persönliche Komfort-Daten und bewusst auch ohne
 * konfigurierten KI-Endpunkt verwaltbar.
 */

interface TemplatePayload {
	title: string;
	content: string;
}

/**
 * Validiert/normalisiert den JSON-Body von POST/PUT. Liefert null bei
 * ungültigen Daten (Titel/Text nicht-leer und innerhalb der Limits).
 */
function parseTemplatePayload(body: unknown): TemplatePayload | null {
	if (typeof body !== "object" || body === null) return null;
	const { title, content } = body as { title?: unknown; content?: unknown };
	if (typeof title !== "string" || typeof content !== "string") return null;
	const trimmedTitle = title.trim();
	const trimmedContent = content.trim();
	if (
		trimmedTitle.length === 0 ||
		trimmedTitle.length > MAX_PROMPT_TEMPLATE_TITLE_CHARS ||
		trimmedContent.length === 0 ||
		trimmedContent.length > MAX_PROMPT_TEMPLATE_CONTENT_CHARS
	) {
		return null;
	}
	return { title: trimmedTitle, content: trimmedContent };
}

function invalidPayloadResponse(t: Awaited<ReturnType<typeof getT>>) {
	return NextResponse.json(
		{
			error: t("chat.templates.route.invalidPayload", {
				maxTitle: MAX_PROMPT_TEMPLATE_TITLE_CHARS,
				maxContent: MAX_PROMPT_TEMPLATE_CONTENT_CHARS,
			}),
		},
		{ status: 400 }
	);
}

export async function GET() {
	const t = await getT();
	try {
		const user = await getCurrentUser();
		if (!user) {
			return NextResponse.json({ error: t("chat.route.unauthorized") }, { status: 401 });
		}
		return NextResponse.json({ templates: listPromptTemplates(user.id) });
	} catch (error) {
		console.error("[ai] Prompt-Vorlagen konnten nicht geladen werden:", error);
		return NextResponse.json({ error: t("chat.templates.route.loadFailed") }, { status: 500 });
	}
}

export async function POST(request: Request) {
	const t = await getT();
	try {
		const user = await getCurrentUser();
		if (!user) {
			return NextResponse.json({ error: t("chat.route.unauthorized") }, { status: 401 });
		}
		const payload = parseTemplatePayload(await request.json().catch(() => null));
		if (!payload) return invalidPayloadResponse(t);
		if (countPromptTemplates(user.id) >= MAX_PROMPT_TEMPLATES_PER_USER) {
			return NextResponse.json(
				{ error: t("chat.templates.route.limitReached", { max: MAX_PROMPT_TEMPLATES_PER_USER }) },
				{ status: 400 }
			);
		}
		const template: PromptTemplate = createPromptTemplate(user.id, payload);
		return NextResponse.json({ template }, { status: 201 });
	} catch (error) {
		console.error("[ai] Prompt-Vorlage konnte nicht angelegt werden:", error);
		return NextResponse.json({ error: t("chat.templates.route.saveFailed") }, { status: 500 });
	}
}

export async function PUT(request: Request) {
	const t = await getT();
	try {
		const user = await getCurrentUser();
		if (!user) {
			return NextResponse.json({ error: t("chat.route.unauthorized") }, { status: 401 });
		}
		const body: unknown = await request.json().catch(() => null);
		const id = typeof body === "object" && body !== null ? (body as { id?: unknown }).id : undefined;
		if (typeof id !== "string" || id.trim() === "") {
			return NextResponse.json({ error: t("chat.templates.route.invalidId") }, { status: 400 });
		}
		const payload = parseTemplatePayload(body);
		if (!payload) return invalidPayloadResponse(t);
		const template = updatePromptTemplate(user.id, id, payload);
		if (!template) {
			return NextResponse.json({ error: t("chat.templates.route.notFound") }, { status: 404 });
		}
		return NextResponse.json({ template });
	} catch (error) {
		console.error("[ai] Prompt-Vorlage konnte nicht aktualisiert werden:", error);
		return NextResponse.json({ error: t("chat.templates.route.saveFailed") }, { status: 500 });
	}
}

export async function DELETE(request: Request) {
	const t = await getT();
	try {
		const user = await getCurrentUser();
		if (!user) {
			return NextResponse.json({ error: t("chat.route.unauthorized") }, { status: 401 });
		}
		const id = new URL(request.url).searchParams.get("id") ?? "";
		if (id.trim() === "") {
			return NextResponse.json({ error: t("chat.templates.route.invalidId") }, { status: 400 });
		}
		if (!deletePromptTemplate(user.id, id)) {
			return NextResponse.json({ error: t("chat.templates.route.notFound") }, { status: 404 });
		}
		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("[ai] Prompt-Vorlage konnte nicht gelöscht werden:", error);
		return NextResponse.json({ error: t("chat.templates.route.deleteFailed") }, { status: 500 });
	}
}
