"use client";

import { useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";
import { showError } from "@/lib/toast";

type ActionResult = { error?: string } | void;

export function ConfirmDeleteButton({
	action,
	confirmMessage,
}: {
	action: () => Promise<ActionResult>;
	/** Optionale, fachlich sprechendere Bestätigungsfrage (sonst Standardtext). */
	confirmMessage?: string;
}) {
	const { t } = useI18n();
	const [isPending, startTransition] = useTransition();

	function handleClick() {
		if (typeof window !== "undefined" && !window.confirm(confirmMessage ?? t("common.confirmDeleteDefault"))) {
			return;
		}
		startTransition(async () => {
			const result = await action();
			if (result?.error) {
				showError(result.error);
			}
		});
	}

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			onClick={handleClick}
			disabled={isPending}
			aria-label={t("common.delete")}
			title={t("common.delete")}
		>
			{isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4 text-destructive" />}
		</Button>
	);
}