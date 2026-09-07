"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/action-state";
import { AVAILABLE_PLACEHOLDERS, documentTemplateCategoryLabels } from "@/lib/templates";

import { saveDocumentTemplateAction } from "@/app/(app)/vorlagen/actions";
import type { DocumentTemplate } from "@/data/types";

export function TemplateFormDialog({ template }: { template?: DocumentTemplate }) {
	const isEdit = Boolean(template);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveDocumentTemplateAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state.success]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{isEdit ? (
					<Button variant="ghost" size="icon-sm" aria-label="Bearbeiten" title="Bearbeiten">
						<Pencil className="size-4" />
					</Button>
				) : (
					<Button type="button">
						<Plus />
						Neue Vorlage
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-2xl">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? "Vorlage bearbeiten" : "Neue Dokumentvorlage"}</DialogTitle>
						<DialogDescription>Text der Vorlage inkl. Platzhaltern, die beim Erzeugen eines konkreten Schreibens automatisch ersetzt werden.</DialogDescription>
					</DialogHeader>

					{isEdit ? <input type="hidden" name="id" value={template!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-3 gap-4">
							<div className="col-span-2 grid gap-2">
								<Label htmlFor="title">Titel *</Label>
								<Input id="title" name="title" defaultValue={template?.title} placeholder="z. B. Mahnung Mietzahlung" required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="category">Kategorie</Label>
								<Select name="category" defaultValue={template?.category ?? "GENERAL"}>
									<SelectTrigger id="category" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{Object.entries(documentTemplateCategoryLabels).map(([value, label]) => (
											<SelectItem key={value} value={value}>
												{label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="subject">Betreff</Label>
							<Input id="subject" name="subject" defaultValue={template?.subject ?? ""} placeholder="z. B. Abmahnung wegen ausstehender Mietzahlung" />
						</div>

						<div className="grid gap-2">
							<Label htmlFor="body">Text *</Label>
							<Textarea
								id="body"
								name="body"
								defaultValue={template?.body ?? ""}
								className="min-h-48"
								placeholder={"Sehr geehrte/r {{mieter.vorname}} {{mieter.nachname}},\n\n..."}
								required
							/>
						</div>

						<div className="rounded-lg border bg-muted/40 p-3">
							<p className="mb-2 text-xs font-medium text-muted-foreground">Verfügbare Platzhalter (zum Einfügen anklicken):</p>
							<div className="flex flex-col gap-2">
								{AVAILABLE_PLACEHOLDERS.map((group) => (
									<div key={group.group} className="flex flex-wrap items-center gap-1.5">
										<span className="text-xs text-muted-foreground">{group.groupLabel}:</span>
										{group.placeholders.map((placeholder) => (
											<button
												key={placeholder.key}
												type="button"
												title={placeholder.label}
												className="rounded-md border bg-background px-1.5 py-0.5 font-mono text-xs hover:bg-accent"
												onClick={(event) => {
													const form = event.currentTarget.closest("form");
													const textarea = form?.querySelector<HTMLTextAreaElement>("textarea[name='body']");
													if (!textarea) return;
													const token = `{{${placeholder.key}}}`;
													const start = textarea.selectionStart ?? textarea.value.length;
													const end = textarea.selectionEnd ?? textarea.value.length;
													textarea.value = textarea.value.slice(0, start) + token + textarea.value.slice(end);
													const cursor = start + token.length;
													textarea.focus();
													textarea.setSelectionRange(cursor, cursor);
												}}
											>
												{`{{${placeholder.key}}}`}
											</button>
										))}
									</div>
								))}
							</div>
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
