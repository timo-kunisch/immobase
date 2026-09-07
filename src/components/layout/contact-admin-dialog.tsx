"use client";

import { useActionState, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState } from "@/lib/action-state";

import { sendContactMessageAction } from "@/lib/contact/actions";

export function ContactAdminDialog() {
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(sendContactMessageAction, initialActionState);

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				setOpen(nextOpen);
			}}
		>
			<DialogTrigger asChild>
				<Button type="button" variant="ghost" size="icon-sm" title="Administrator kontaktieren" aria-label="Administrator kontaktieren">
					<MessageCircle className="size-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				{state.success ? (
					<>
						<DialogHeader>
							<DialogTitle>Nachricht gesendet</DialogTitle>
							<DialogDescription>{state.message}</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<Button type="button" onClick={() => setOpen(false)}>
								Schließen
							</Button>
						</DialogFooter>
					</>
				) : (
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
							<Button type="button" variant="outline" onClick={() => setOpen(false)}>
								Abbrechen
							</Button>
							<Button type="submit" disabled={isPending}>
								{isPending ? <Loader2 className="animate-spin" /> : null}
								Senden
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
