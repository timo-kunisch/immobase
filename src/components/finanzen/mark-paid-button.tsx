"use client";

import { useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";
import { showError } from "@/lib/toast";
import { markTransactionPaidAction } from "@/app/(app)/finanzen/actions";

export function MarkPaidButton({ transactionId }: { transactionId: string }) {
	const { t } = useI18n();
	const [isPending, startTransition] = useTransition();

	function handleClick() {
		startTransition(async () => {
			const result = await markTransactionPaidAction(transactionId);
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
			aria-label={t("finances.actions.markPaid")}
			title={t("finances.actions.markPaid")}
		>
			{isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4 text-emerald-600" />}
		</Button>
	);
}
