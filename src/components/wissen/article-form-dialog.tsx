"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState } from "@/lib/action-state";

import { saveKnowledgeArticleAction } from "@/app/(app)/wissen/actions";
import type { KnowledgeBaseArticle } from "@/data/types";

/**
 * Dialog zum Anlegen/Bearbeiten eines Wissensartikels. Die Kategorie ist
 * ein optionales Freitext-Schlagwort; bereits vergebene Kategorien werden
 * per datalist als Vorschläge angeboten.
 */
export function ArticleFormDialog({ article, categories }: { article?: KnowledgeBaseArticle; categories: string[] }) {
	const isEdit = Boolean(article);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveKnowledgeArticleAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state.success]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{isEdit ? (
					<Button variant="outline" size="sm">
						<Pencil />
						Bearbeiten
					</Button>
				) : (
					<Button type="button">
						<Plus />
						Neuer Artikel
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-2xl">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? "Artikel bearbeiten" : "Neuer Artikel"}</DialogTitle>
						<DialogDescription>Richtlinie, Anweisung oder Erklärung in der Wissensdatenbank ablegen.</DialogDescription>
					</DialogHeader>

					{isEdit ? <input type="hidden" name="id" value={article!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="title">Titel *</Label>
								<Input id="title" name="title" placeholder="z. B. Richtlinie für Mieterhöhungen" defaultValue={article?.title} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="category">Kategorie (optional)</Label>
								<Input
									id="category"
									name="category"
									list="knowledge-categories"
									placeholder="z. B. Abrechnung"
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
							<Label htmlFor="content">Inhalt *</Label>
							<Textarea
								id="content"
								name="content"
								rows={12}
								placeholder="Text des Artikels…"
								defaultValue={article?.content ?? ""}
								required
							/>
						</div>

						{state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							Abbrechen
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending ? <Loader2 className="animate-spin" /> : null}
							Speichern
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
