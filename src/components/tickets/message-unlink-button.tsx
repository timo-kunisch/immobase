"use client";

import { useState, useTransition } from "react";
import { Loader2, Unlink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";

import { unlinkTicketMessageAction } from "@/app/(app)/tickets/actions";
import type { TicketMessage } from "@/data/types";

/**
 * Löst die Zuordnung einer eingehenden E-Mail zum Ticket (mit
 * Bestätigungsabfrage) - die E-Mail landet zurück im Postfach.
 */
export function MessageUnlinkButton({ message }: { message: TicketMessage }) {
	const { t } = useI18n();
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	function handleClick() {
		if (
			typeof window !== "undefined" &&
			!window.confirm(t("tickets.confirm.unlink", { subject: message.subject ?? t("tickets.email.noSubject") }))
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
				aria-label={t("tickets.actions.unlink")}
				title={t("tickets.actions.unlinkTitle")}
			>
				{isPending ? <Loader2 className="size-4 animate-spin" /> : <Unlink className="size-4 text-muted-foreground" />}
			</Button>
			{error ? <span className="text-xs text-destructive">{error}</span> : null}
		</div>
	);
}
