"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";
import { finalizeBillingPeriodAction } from "@/app/(app)/abrechnung/actions";

export function FinalizeBillingPeriodButton({ billingPeriodId }: { billingPeriodId: string }) {
	const { t } = useI18n();
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	function handleClick() {
		if (typeof window !== "undefined" && !window.confirm(t("billing.confirm.finalize"))) {
			return;
		}
		setError(null);
		startTransition(async () => {
			const result = await finalizeBillingPeriodAction(billingPeriodId);
			if (result?.error) {
				setError(result.error);
			}
		});
	}

	return (
		<div className="flex flex-col items-end gap-1">
			<Button type="button" onClick={handleClick} disabled={isPending}>
				{isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
				{t("billing.actions.finalize")}
			</Button>
			{error ? <span className="text-xs text-destructive">{error}</span> : null}
		</div>
	);
}
