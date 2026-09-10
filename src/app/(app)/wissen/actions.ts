"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
	createKnowledgeBaseArticle,
	deleteKnowledgeBaseArticle,
	getKnowledgeBaseArticle,
	updateKnowledgeBaseArticle,
} from "@/data/knowledge-base";
import { requireUser } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { ActionState } from "@/lib/action-state";
import { getT } from "@/lib/i18n/server";

function getString(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === "string" ? value.trim() : "";
}

export async function saveKnowledgeArticleAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const id = getString(formData, "id");
	const title = getString(formData, "title");
	const category = getString(formData, "category");
	const content = getString(formData, "content");

	if (!title || !content) {
		return { error: t("knowledge.errors.titleAndContentRequired") };
	}

	const data = { title, category: category || null, content };

	try {
		if (id) {
			updateKnowledgeBaseArticle(id, data);
			logActivity(user, "UPDATE", "wissen", `Wissensartikel „${title}“ bearbeitet`, id);
		} else {
			const article = createKnowledgeBaseArticle(data);
			logActivity(user, "CREATE", "wissen", `Wissensartikel „${title}“ angelegt`, article.id);
		}
	} catch (error) {
		console.error("saveKnowledgeArticleAction failed", error);
		return { error: t("knowledge.errors.saveFailed") };
	}

	revalidatePath("/wissen");
	if (id) {
		revalidatePath(`/wissen/${id}`);
	}
	return { success: true };
}

export async function deleteKnowledgeArticleAction(id: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	// Bezeichnung vor dem Löschen ermitteln (für den Log-Eintrag).
	const article = getKnowledgeBaseArticle(id);
	try {
		deleteKnowledgeBaseArticle(id);
	} catch (error) {
		console.error("deleteKnowledgeArticleAction failed", error);
		return { error: t("knowledge.errors.deleteFailed") };
	}

	logActivity(user, "DELETE", "wissen", `Wissensartikel „${article ? article.title : id}“ gelöscht`, id);

	revalidatePath("/wissen");
	// Der Löschen-Button sitzt auf der Detailseite - danach zurück zur Liste.
	redirect("/wissen");
}
