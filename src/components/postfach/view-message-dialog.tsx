"use client";

import { useState } from "react";
import { MailOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

import type { TicketMessage } from "@/data/types";

/**
 * Zeigt eine Postfach-E-Mail vollständig an (die Kartenansicht kürzt den
 * Text auf wenige Zeilen). Der Inhalt scrollt innerhalb des Dialogs, damit
 * auch sehr lange E-Mails lesbar bleiben.
 */
export function ViewMessageDialog({ message }: { message: TicketMessage }) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button type="button" variant="outline" size="sm">
					<MailOpen className="size-4" />
					{t("common.open")}
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle className="pr-8 leading-snug">{message.subject ?? t("tickets.email.noSubject")}</DialogTitle>
					<DialogDescription>
						{t("common.from")}: {message.fromAddress ?? "–"}
						{message.toAddresses ? <> · {t("tickets.email.to")}: {message.toAddresses}</> : null} · {formatDateTime(message.createdAt)}
					</DialogDescription>
				</DialogHeader>

				<div className="max-h-[60vh] overflow-y-auto rounded-lg border p-3 text-sm break-words whitespace-pre-wrap">
					{message.bodyText || t("tickets.email.noContent")}
				</div>

				<DialogFooter>
					<Button type="button" variant="outline" onClick={() => setOpen(false)}>
						{t("common.close")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
