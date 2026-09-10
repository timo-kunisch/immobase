"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BookMarked, Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PromptTemplate } from "@/data/types";
import {
	DEFAULT_PROMPT_TEMPLATES,
	MAX_PROMPT_TEMPLATE_CONTENT_CHARS,
	MAX_PROMPT_TEMPLATE_TITLE_CHARS,
} from "@/lib/ai/prompt-templates";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Vorlagen-Panel des KI-Assistenten (über dem Eingabefeld des Chat-Dialogs,
 * ein-/ausblendbar über den Buch-Button): Listet die lokalisierten Vorlagen
 * ab Werk (src/lib/ai/prompt-templates.ts - nicht editierbar) und die
 * eigenen Vorlagen des Nutzers (Route /api/chat/prompt-templates, Tabelle
 * prompt_templates). Ein Klick auf eine Vorlage übergibt ihren Text über
 * onInsert an den Dialog (der ihn ins Eingabefeld übernimmt). Eigene
 * Vorlagen können hier angelegt, bearbeitet und gelöscht werden (Löschen
 * mit Inline-Bestätigung); das Panel hält seine Liste lokal und muss daher
 * nach Änderungen nicht neu laden.
 */

interface TemplateFormState {
	/** null = neue Vorlage anlegen; sonst ID der bearbeiteten Vorlage. */
	id: string | null;
	title: string;
	content: string;
}

export function PromptTemplatesPanel({ onInsert }: { onInsert: (content: string) => void }) {
	const { t } = useI18n();
	const [templates, setTemplates] = useState<PromptTemplate[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [form, setForm] = useState<TemplateFormState | null>(null);
	const [saving, setSaving] = useState(false);
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
	const [deleting, setDeleting] = useState(false);

	// Eigene Vorlagen beim ersten Einblenden laden (das Panel wird nur
	// gerendert, solange es eingeblendet ist).
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const response = await fetch("/api/chat/prompt-templates");
				const data = (await response.json().catch(() => null)) as { templates?: PromptTemplate[]; error?: string } | null;
				if (!response.ok || data === null || !Array.isArray(data.templates)) {
					throw new Error(data?.error ?? t("chat.templates.loadFailed", { status: response.status }));
				}
				if (!cancelled) setTemplates(data.templates);
			} catch (cause) {
				if (!cancelled) {
					setError(cause instanceof Error ? cause.message : t("chat.templates.loadFailed", { status: "?" }));
				}
			}
		})();
		return () => {
			cancelled = true;
		};
		// t: nur für die Fehlermeldungen; ein Nachladen beim Sprachwechsel ist harmlos.
	}, [t]);

	/** Speichert das Formular: POST für neue, PUT für bestehende Vorlagen. */
	async function handleSave(): Promise<void> {
		if (!form || saving) return;
		const title = form.title.trim();
		const content = form.content.trim();
		if (!title || !content) {
			setError(
				t("chat.templates.validation", {
					maxTitle: MAX_PROMPT_TEMPLATE_TITLE_CHARS,
					maxContent: MAX_PROMPT_TEMPLATE_CONTENT_CHARS,
				})
			);
			return;
		}
		setSaving(true);
		setError(null);
		try {
			const isEdit = form.id !== null;
			const response = await fetch("/api/chat/prompt-templates", {
				method: isEdit ? "PUT" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(isEdit ? { id: form.id, title, content } : { title, content }),
			});
			const data = (await response.json().catch(() => null)) as { template?: PromptTemplate; error?: string } | null;
			if (!response.ok || data === null || !data.template) {
				throw new Error(data?.error ?? t("chat.templates.saveFailed", { status: response.status }));
			}
			const saved = data.template;
			setTemplates((current) =>
				current === null
					? [saved]
					: isEdit
						? current.map((template) => (template.id === saved.id ? saved : template))
						: [...current, saved]
			);
			setForm(null);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : t("chat.templates.saveFailed", { status: "?" }));
		} finally {
			setSaving(false);
		}
	}

	/** Löscht eine eigene Vorlage (nach Inline-Bestätigung). */
	async function handleDelete(id: string): Promise<void> {
		if (deleting) return;
		setDeleting(true);
		setError(null);
		try {
			const response = await fetch(`/api/chat/prompt-templates?id=${encodeURIComponent(id)}`, { method: "DELETE" });
			if (!response.ok) {
				const data = (await response.json().catch(() => null)) as { error?: string } | null;
				throw new Error(data?.error ?? t("chat.templates.deleteFailed", { status: response.status }));
			}
			setTemplates((current) => (current === null ? current : current.filter((template) => template.id !== id)));
			setConfirmDeleteId(null);
			if (form?.id === id) setForm(null);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : t("chat.templates.deleteFailed", { status: "?" }));
		} finally {
			setDeleting(false);
		}
	}

	/** Kopfzeile einer Vorlage: Titel + Vorschau der ersten Textzeile. */
	function renderInsertRow(key: string, title: string, content: string, badge: boolean, actions?: ReactNode) {
		return (
			<div key={key} className="flex items-center gap-1 rounded-md border bg-background px-2 py-1.5">
				<button
					type="button"
					onClick={() => onInsert(content)}
					title={t("chat.templates.insert")}
					className="min-w-0 flex-1 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
				>
					<span className="flex items-center gap-1.5">
						<span className="truncate text-sm font-medium">{title}</span>
						{badge ? (
							<Badge variant="secondary" className="shrink-0 px-1 py-0 text-[0.65rem]">
								{t("chat.templates.defaultBadge")}
							</Badge>
						) : null}
					</span>
					<span className="block truncate text-xs text-muted-foreground">{content}</span>
				</button>
				{actions}
			</div>
		);
	}

	return (
		<div className="space-y-2 rounded-md border bg-muted/30 p-2">
			<div className="flex items-center justify-between gap-2">
				<p className="flex items-center gap-1.5 text-xs font-medium">
					<BookMarked className="size-3.5" />
					{t("chat.templates.title")}
					<span className="font-normal text-muted-foreground">- {t("chat.templates.hint")}</span>
				</p>
				{form === null ? (
					<Button
						type="button"
						variant="ghost"
						size="xs"
						onClick={() => {
							setForm({ id: null, title: "", content: "" });
							setError(null);
						}}
					>
						<Plus className="size-3" />
						{t("chat.templates.new")}
					</Button>
				) : null}
			</div>

			{form !== null ? (
				<div className="space-y-1.5 rounded-md border bg-background p-2">
					<p className="text-xs font-medium">
						{form.id === null ? t("chat.templates.formTitleNew") : t("chat.templates.formTitleEdit")}
					</p>
					<Input
						value={form.title}
						onChange={(event) => setForm({ ...form, title: event.target.value })}
						placeholder={t("chat.templates.namePlaceholder")}
						maxLength={MAX_PROMPT_TEMPLATE_TITLE_CHARS}
						disabled={saving}
						className="h-7 text-sm"
					/>
					<Textarea
						value={form.content}
						onChange={(event) => setForm({ ...form, content: event.target.value })}
						placeholder={t("chat.templates.contentPlaceholder")}
						maxLength={MAX_PROMPT_TEMPLATE_CONTENT_CHARS}
						disabled={saving}
						rows={3}
						className="min-h-16 resize-none text-sm"
					/>
					<div className="flex justify-end gap-1">
						<Button type="button" variant="ghost" size="xs" disabled={saving} onClick={() => setForm(null)}>
							{t("common.cancel")}
						</Button>
						<Button type="button" size="xs" disabled={saving} onClick={() => void handleSave()}>
							{saving ? <Loader2 className="size-3 animate-spin" /> : null}
							{t("common.save")}
						</Button>
					</div>
				</div>
			) : null}

			<div className="max-h-56 space-y-1 overflow-y-auto">
				{/* Vorlagen ab Werk: lokalisiert, für alle Nutzer, nicht editierbar. */}
				{DEFAULT_PROMPT_TEMPLATES.map((template) =>
					renderInsertRow(template.id, t(template.titleKey), t(template.contentKey), true)
				)}

				{/* Eigene Vorlagen des Nutzers mit Bearbeiten/Löschen. */}
				{templates === null ? (
					<p className="flex items-center gap-2 px-1 py-1.5 text-xs text-muted-foreground">
						<Loader2 className="size-3 animate-spin" />
						{t("chat.templates.loading")}
					</p>
				) : templates.length === 0 ? (
					<p className="px-1 py-1.5 text-xs text-muted-foreground">{t("chat.templates.emptyMine")}</p>
				) : (
					templates.map((template) =>
						renderInsertRow(template.id, template.title, template.content, false, (
							<span className="flex shrink-0 items-center">
								{confirmDeleteId === template.id ? (
									<>
										<Button
											type="button"
											variant="destructive"
											size="xs"
											disabled={deleting}
											onClick={() => void handleDelete(template.id)}
										>
											{deleting ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
											{t("chat.templates.deleteConfirm")}
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon-xs"
											aria-label={t("common.cancel")}
											title={t("common.cancel")}
											disabled={deleting}
											onClick={() => setConfirmDeleteId(null)}
										>
											<X className="size-3" />
										</Button>
									</>
								) : (
									<>
										<Button
											type="button"
											variant="ghost"
											size="icon-xs"
											aria-label={t("chat.templates.edit")}
											title={t("chat.templates.edit")}
											onClick={() => {
												setForm({ id: template.id, title: template.title, content: template.content });
												setConfirmDeleteId(null);
												setError(null);
											}}
										>
											<Pencil className="size-3" />
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon-xs"
											aria-label={t("chat.templates.delete")}
											title={t("chat.templates.delete")}
											onClick={() => setConfirmDeleteId(template.id)}
										>
											<Trash2 className="size-3" />
										</Button>
									</>
								)}
							</span>
						))
					)
				)}
			</div>

			{error ? <p className="text-xs text-destructive">{error}</p> : null}
		</div>
	);
}
