"use client";

import { useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";
import { showError } from "@/lib/toast";
import { syncMailboxAction } from "@/app/(app)/postfach/actions";

/** Manueller Abruf des IMAP-Postfachs mit Ergebnis-Rückmeldung. */
export function MailboxSyncButton() {
	const { t } = useI18n();
	const [isPending, startTransition] = useTransition();
	const [message, setMessage] = useState<string | null>(null);

	function handleClick() {
		setMessage(null);
		startTransition(async () => {
			const state = await syncMailboxAction();
			if (state.error) {
				showError(state.error);
			} else {
				setMessage(state.message ?? null);
			}
		});
	}

	return (
		<div className="flex items-center gap-2">
			<Button type="button" variant="outline" onClick={handleClick} disabled={isPending}>
				{isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
				{t("tickets.mailbox.syncNow")}
			</Button>
			{message ? <span className="text-xs text-emerald-600">{message}</span> : null}
		</div>
	);
}
