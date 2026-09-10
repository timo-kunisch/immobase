"use client";

import { useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";
import { showError } from "@/lib/toast";
import { finalizeBillingPeriodAction } from "@/app/(app)/abrechnung/actions";

export function FinalizeBillingPeriodButton({ billingPeriodId }: { billingPeriodId: string }) {
	const { t } = useI18n();
	const [isPending, startTransition] = useTransition();

	function handleClick() {
		if (typeof window !== "undefined" && !window.confirm(t("billing.confirm.finalize"))) {
			return;
		}
		startTransition(async () => {
			const result = await finalizeBillingPeriodAction(billingPeriodId);
			if (result?.error) {
				showError(result.error);
			}
		});
	}

	return (
		<Button type="button" onClick={handleClick} disabled={isPending}>
			{isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
			{t("billing.actions.finalize")}
		</Button>
	);
}
