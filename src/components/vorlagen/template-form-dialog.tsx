"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";
import { AVAILABLE_PLACEHOLDERS, documentTemplateCategoryLabelKeys } from "@/lib/templates";

import { saveDocumentTemplateAction } from "@/app/(app)/vorlagen/actions";
import type { DocumentTemplate } from "@/data/types";

export function TemplateFormDialog({ template }: { template?: DocumentTemplate }) {
	const { t } = useI18n();
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
					<Button variant="ghost" size="icon-sm" aria-label={t("common.edit")} title={t("common.edit")}>
						<Pencil className="size-4" />
					</Button>
				) : (
					<Button type="button">
						<Plus />
						{t("templates.actions.create")}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-2xl">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? t("templates.dialog.editTitle") : t("templates.dialog.createTitle")}</DialogTitle>
						<DialogDescription>{t("templates.dialog.description")}</DialogDescription>
					</DialogHeader>

					{isEdit ? <input type="hidden" name="id" value={template!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-3 gap-4">
							<div className="col-span-2 grid gap-2">
								<Label htmlFor="title">{t("templates.fields.title")} *</Label>
								<Input id="title" name="title" defaultValue={template?.title} placeholder={t("templates.fields.titlePlaceholder")} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="category">{t("templates.fields.category")}</Label>
								<Select name="category" defaultValue={template?.category ?? "GENERAL"}>
									<SelectTrigger id="category" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{Object.entries(documentTemplateCategoryLabelKeys).map(([value, labelKey]) => (
											<SelectItem key={value} value={value}>
												{t(labelKey)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="subject">{t("templates.fields.subject")}</Label>
							<Input id="subject" name="subject" defaultValue={template?.subject ?? ""} placeholder={t("templates.fields.subjectPlaceholder")} />
						</div>

						<div className="grid gap-2">
							<Label htmlFor="body">{t("templates.fields.body")} *</Label>
							<Textarea
								id="body"
								name="body"
								defaultValue={template?.body ?? ""}
								className="min-h-48"
								placeholder={t("templates.fields.bodyPlaceholder")}
								required
							/>
						</div>

						<div className="rounded-lg border bg-muted/40 p-3">
							<p className="mb-2 text-xs font-medium text-muted-foreground">{t("templates.placeholders.hint")}</p>
							<div className="flex flex-col gap-2">
								{AVAILABLE_PLACEHOLDERS.map((group) => (
									<div key={group.group} className="flex flex-wrap items-center gap-1.5">
										<span className="text-xs text-muted-foreground">{t(group.groupLabelKey)}:</span>
										{group.placeholders.map((placeholder) => (
											<button
												key={placeholder.key}
												type="button"
												title={t(placeholder.labelKey)}
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
