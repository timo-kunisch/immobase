"use client";

import { useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";
import { showError } from "@/lib/toast";
import { finalizeAnnualStatementAction } from "@/app/(app)/weg/jahresabrechnung/actions";

export function FinalizeAnnualStatementButton({ annualStatementId, hoaId }: { annualStatementId: string; hoaId: string }) {
	const { t } = useI18n();
	const [isPending, startTransition] = useTransition();

	function handleClick() {
		if (typeof window !== "undefined" && !window.confirm(t("hoaStatement.confirm.finalize"))) {
			return;
		}
		startTransition(async () => {
			const result = await finalizeAnnualStatementAction(annualStatementId, hoaId);
			if (result?.error) {
				showError(result.error);
			}
		});
	}

	return (
		<Button type="button" onClick={handleClick} disabled={isPending}>
			{isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
			{t("hoaStatement.actions.finalize")}
		</Button>
	);
}
