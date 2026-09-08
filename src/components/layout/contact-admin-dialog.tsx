"use client";

import { useActionState, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState } from "@/lib/action-state";

import { sendContactMessageAction } from "@/lib/contact/actions";

/**
 * Dialog "Administrator kontaktieren" (Sidebar-Footer). Nachrichten können
 * nur versendet werden, wenn ein SMTP-Server konfiguriert ist
 * (`smtpConfigured` kommt aus dem Server-Layout; die Server Action prüft es
 * zusätzlich selbst autoritativ nach).
 */
export function ContactAdminDialog({ smtpConfigured }: { smtpConfigured: boolean }) {
	const [open, setOpen] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button type="button" variant="ghost" size="icon-sm" title="Administrator kontaktieren" aria-label="Administrator kontaktieren">
					<MessageCircle className="size-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				{/* Der Inhalt liegt in einer eigenen Komponente, weil Radix den
				    Dialog-Inhalt beim Schließen unmountet: So startet der
				    useActionState-Zustand bei jedem Öffnen frisch und nach einer
				    gesendeten Nachricht erscheint beim nächsten Öffnen wieder das
				    Formular statt der alten Bestätigung. */}
				<ContactAdminDialogContent smtpConfigured={smtpConfigured} close={() => setOpen(false)} />
			</DialogContent>
		</Dialog>
	);
}

function ContactAdminDialogContent({ smtpConfigured, close }: { smtpConfigured: boolean; close: () => void }) {
	const [state, formAction, isPending] = useActionState(sendContactMessageAction, initialActionState);

	if (!smtpConfigured) {
		return (
			<>
				<DialogHeader>
					<DialogTitle>Administrator kontaktieren</DialogTitle>
					<DialogDescription>
						Nachrichten können derzeit nicht versendet werden, weil kein E-Mail-Server konfiguriert ist.
					</DialogDescription>
				</DialogHeader>
				<p className="text-sm text-muted-foreground">
					Ein Administrator kann den E-Mail-Versand unter Einstellungen → Online-Integrationen einrichten.
				</p>
				<DialogFooter>
					<Button type="button" onClick={close}>
						Schließen
					</Button>
				</DialogFooter>
			</>
		);
	}

	if (state.success) {
		return (
			<>
				<DialogHeader>
					<DialogTitle>Nachricht gesendet</DialogTitle>
					<DialogDescription>{state.message}</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button type="button" onClick={close}>
						Schließen
					</Button>
				</DialogFooter>
			</>
		);
	}

	return (
		<form action={formAction}>
			<DialogHeader>
				<DialogTitle>Administrator kontaktieren</DialogTitle>
				<DialogDescription>Ihre Nachricht wird per E-Mail an den Administrator gesendet.</DialogDescription>
			</DialogHeader>

			<div className="grid gap-4 py-4">
				<div className="grid gap-2">
					<Label htmlFor="contact-message">Nachricht *</Label>
					<Textarea id="contact-message" name="message" placeholder="Beschreiben Sie Ihr Anliegen…" rows={6} required />
				</div>

				{state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
			</div>

			<DialogFooter>
				<Button type="button" variant="outline" onClick={close}>
					Abbrechen
				</Button>
				<Button type="submit" disabled={isPending}>
					{isPending ? <Loader2 className="animate-spin" /> : null}
					Senden
				</Button>
			</DialogFooter>
		</form>
	);
}
