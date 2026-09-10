"use client";

import { useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";
import { syncMailboxAction } from "@/app/(app)/postfach/actions";

/** Manueller Abruf des IMAP-Postfachs mit Ergebnis-Rückmeldung. */
export function MailboxSyncButton() {
	const { t } = useI18n();
	const [isPending, startTransition] = useTransition();
	const [result, setResult] = useState<{ error?: string; message?: string } | null>(null);

	function handleClick() {
		setResult(null);
		startTransition(async () => {
			const state = await syncMailboxAction();
			setResult({ error: state.error, message: state.message });
		});
	}

	return (
		<div className="flex items-center gap-2">
			<Button type="button" variant="outline" onClick={handleClick} disabled={isPending}>
				{isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
				{t("tickets.mailbox.syncNow")}
			</Button>
			{result?.error ? <span className="text-xs text-destructive">{result.error}</span> : null}
			{result?.message ? <span className="text-xs text-emerald-600">{result.message}</span> : null}
		</div>
	);
}
