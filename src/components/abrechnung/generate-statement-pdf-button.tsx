"use client";

import { useState, useTransition } from "react";
import { FileText, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { generateBillingStatementPdfAction, sendStatementByPostAction } from "@/app/(app)/abrechnung/actions";
import { formatFileSize } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { SendByPostButton } from "@/components/postal-shipments/send-by-post-button";

/**
 * Zeigt je TenantStatement entweder einen "PDF erzeugen"-Button (noch kein
 * PDF vorhanden) oder einen Download-Link + "Neu erzeugen"-Button (bereits
 * vorhanden, z. B. nach Korrektur der Absenderdaten unter /einstellungen).
 */
export function GenerateStatementPdfButton({
	tenantStatementId,
	pdfPath,
	pdfFileSize,
	postalConfigured,
}: {
	tenantStatementId: string;
	pdfPath: string | null;
	pdfFileSize: number | null;
	/** Ob LetterXpress-Zugangsdaten hinterlegt sind (Einstellungen). */
	postalConfigured: boolean;
}) {
	const { t } = useI18n();
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	function handleClick() {
		setError(null);
		startTransition(async () => {
			const result = await generateBillingStatementPdfAction(tenantStatementId);
			if (result?.error) {
				setError(result.error);
			}
		});
	}

	if (!pdfPath) {
		return (
			<div className="flex flex-col items-end gap-1">
				<Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={isPending}>
					{isPending ? <Loader2 className="animate-spin" /> : <FileText />}
					{t("billing.actions.generatePdf")}
				</Button>
				{error ? <span className="text-xs text-destructive">{error}</span> : null}
			</div>
		);
	}

	return (
		<div className="flex flex-col items-end gap-1">
			<div className="flex items-center gap-1">
				<Button variant="ghost" size="sm" asChild>
					<a href={`/api/uploads/${pdfPath}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5">
						<FileText className="size-4" />
						{t("billing.actions.viewPdf")}
						<span className="text-xs text-muted-foreground">({formatFileSize(pdfFileSize)})</span>
					</a>
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={handleClick}
					disabled={isPending}
					aria-label={t("billing.actions.regeneratePdf")}
					title={t("billing.actions.regeneratePdf")}
				>
					{isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
				</Button>
				<SendByPostButton sendAction={() => sendStatementByPostAction(tenantStatementId)} disabled={!postalConfigured} disabledReason={t("postal.notConfiguredShort")} />
			</div>
			{error ? <span className="text-xs text-destructive">{error}</span> : null}
		</div>
	);
}
