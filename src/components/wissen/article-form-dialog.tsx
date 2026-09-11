"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { saveKnowledgeArticleAction } from "@/app/(app)/wissen/actions";
import type { KnowledgeBaseArticle } from "@/data/types";

/**
 * Dialog zum Anlegen/Bearbeiten eines Wissensartikels. Die Kategorie ist
 * ein optionales Freitext-Schlagwort; bereits vergebene Kategorien werden
 * per datalist als Vorschläge angeboten.
 */
export function ArticleFormDialog({ article, categories }: { article?: KnowledgeBaseArticle; categories: string[] }) {
	const { t } = useI18n();
	const isEdit = Boolean(article);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveKnowledgeArticleAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{isEdit ? (
					<Button variant="outline" size="sm">
						<Pencil />
						{t("common.edit")}
					</Button>
				) : (
					<Button type="button">
						<Plus />
						{t("knowledge.actions.new")}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-2xl">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? t("knowledge.dialog.editTitle") : t("knowledge.dialog.newTitle")}</DialogTitle>
						<DialogDescription>{t("knowledge.dialog.description")}</DialogDescription>
					</DialogHeader>

					{isEdit ? <input type="hidden" name="id" value={article!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="title">{t("knowledge.fields.title")}</Label>
								<Input
									id="title"
									name="title"
									placeholder={t("knowledge.fields.titlePlaceholder")}
									defaultValue={article?.title}
									required
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="category">{t("knowledge.fields.category")}</Label>
								<Input
									id="category"
									name="category"
									list="knowledge-categories"
									placeholder={t("knowledge.fields.categoryPlaceholder")}
									defaultValue={article?.category ?? ""}
								/>
								<datalist id="knowledge-categories">
									{categories.map((category) => (
										<option key={category} value={category} />
									))}
								</datalist>
							</div>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="content">{t("knowledge.fields.content")}</Label>
							<Textarea
								id="content"
								name="content"
								rows={12}
								placeholder={t("knowledge.fields.contentPlaceholder")}
								defaultValue={article?.content ?? ""}
								required
							/>
						</div>

						<ActionErrorToast state={state} />
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							{t("common.cancel")}
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending ? <Loader2 className="animate-spin" /> : null}
							{t("common.save")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
