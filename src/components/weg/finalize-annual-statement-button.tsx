"use client";

import { useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";
import { showError } from "@/lib/toast";
import { finalizeAnnualStatementAction } from "@/app/(app)/weg/jahresabrechnung/actions";

/**
 * Finalisieren mit vorgeschalteter Bestätigung. Bei offenen Hinweisen der
 * Plausibilitätsprüfung (siehe Detailseite) weist die Bestätigungsmeldung
 * zusätzlich darauf hin - die Finalisierung bleibt bewusst möglich
 * (Abweichungen können fachlich gewollt sein), wird aber sichtbar gemacht.
 */
export function FinalizeAnnualStatementButton({
	annualStatementId,
	hoaId,
	consistencyIssueCount,
}: {
	annualStatementId: string;
	hoaId: string;
	/** Anzahl offener Hinweise der Plausibilitätsprüfung (0 = normale Bestätigung). */
	consistencyIssueCount: number;
}) {
	const { t } = useI18n();
	const [isPending, startTransition] = useTransition();

	function handleClick() {
		if (typeof window === "undefined") {
			return;
		}
		const message =
			consistencyIssueCount > 0
				? t("hoaStatement.confirm.finalizeWithIssues", { count: consistencyIssueCount })
				: t("hoaStatement.confirm.finalize");
		if (!window.confirm(message)) {
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