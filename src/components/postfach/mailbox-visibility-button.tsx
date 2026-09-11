"use client";

import { useTransition } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";
import { showError } from "@/lib/toast";

type ActionResult = { error?: string } | void;

/**
 * Blendet eine Postfach-E-Mail aus (EyeOff) bzw. blendet eine ausgeblendete
 * wieder ein (Eye) - ohne Bestätigungsdialog, da nichts gelöscht oder
 * anderweitig einsortiert wird.
 */
export function MailboxVisibilityButton({ action, hidden }: { action: () => Promise<ActionResult>; hidden: boolean }) {
	const { t } = useI18n();
	const [isPending, startTransition] = useTransition();

	function handleClick() {
		startTransition(async () => {
			const result = await action();
			if (result?.error) {
				showError(result.error);
			}
		});
	}

	const label = hidden ? t("tickets.mailbox.actions.unhide") : t("tickets.mailbox.actions.hide");

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			onClick={handleClick}
			disabled={isPending}
			aria-label={label}
			title={label}
		>
			{isPending ? <Loader2 className="size-4 animate-spin" /> : hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
		</Button>
	);
}
