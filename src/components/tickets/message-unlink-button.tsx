"use client";

import { useState, useTransition } from "react";
import { Loader2, Unlink } from "lucide-react";

import { Button } from "@/components/ui/button";

import { unlinkTicketMessageAction } from "@/app/(app)/tickets/actions";
import type { TicketMessage } from "@/data/types";

/**
 * Löst die Zuordnung einer eingehenden E-Mail zum Ticket (mit
 * Bestätigungsabfrage) - die E-Mail landet zurück im Postfach.
 */
export function MessageUnlinkButton({ message }: { message: TicketMessage }) {
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	function handleClick() {
		if (
			typeof window !== "undefined" &&
			!window.confirm(`Zuordnung der E-Mail "${message.subject ?? "(ohne Betreff)"}" zu diesem Ticket aufheben? Sie erscheint wieder im Postfach.`)
		) {
			return;
		}
		setError(null);
		startTransition(async () => {
			const result = await unlinkTicketMessageAction(message.id);
			if (result?.error) {
				setError(result.error);
			}
		});
	}

	return (
		<div className="flex items-center gap-2">
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				onClick={handleClick}
				disabled={isPending}
				aria-label="Zuordnung aufheben"
				title="Zuordnung aufheben (zurück ins Postfach)"
			>
				{isPending ? <Loader2 className="size-4 animate-spin" /> : <Unlink className="size-4 text-muted-foreground" />}
			</Button>
			{error ? <span className="text-xs text-destructive">{error}</span> : null}
		</div>
	);
}
