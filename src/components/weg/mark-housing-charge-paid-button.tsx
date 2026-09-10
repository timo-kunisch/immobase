"use client";

import { useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";
import { markHousingChargePaidAction } from "@/app/(app)/weg/hausgeld/actions";

export function MarkHousingChargePaidButton({ housingChargeId, hoaId }: { housingChargeId: string; hoaId: string }) {
	const { t } = useI18n();
	const [isPending, startTransition] = useTransition();

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			aria-label={t("hoaFinance.charges.actions.markPaid")}
			title={t("hoaFinance.charges.actions.markPaid")}
			disabled={isPending}
			onClick={() =>
				startTransition(() => {
					markHousingChargePaidAction(housingChargeId, hoaId);
				})
			}
		>
			{isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4 text-emerald-600" />}
		</Button>
	);
}
