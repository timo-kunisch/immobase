"use client";

import { useState, useTransition } from "react";
import { FileDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/format";
import { formatDate } from "@/lib/format";

type ActionResult = { error?: string; success?: boolean } | void;

/**
 * Generischer "PDF erzeugen"-Button für Einladung/Protokoll einer
 * Eigentümerversammlung - die konkrete Server Action
 * (generateInvitationPdfAction/generateMinutesPdfAction) wird als Prop
 * übergeben, analog zum Muster von GenerateStatementPdfButton in
 * src/components/abrechnung/generate-statement-pdf-button.tsx.
 */
export function GenerateMeetingPdfButton({
	action,
	label,
	pdfPath,
	pdfFileSize,
	pdfGeneratedAt,
}: {
	action: () => Promise<ActionResult>;
	label: string;
	pdfPath: string | null;
	pdfFileSize: number | null;
	pdfGeneratedAt: string | null;
}) {
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	function handleClick() {
		setError(null);
		startTransition(async () => {
			const result = await action();
			if (result && "error" in result && result.error) {
				setError(result.error);
			}
		});
	}

	return (
		<div className="flex items-center gap-2">
			{pdfPath ? (
				<a href={`/api/uploads/${pdfPath}`} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
					PDF ({formatFileSize(pdfFileSize)}, {formatDate(pdfGeneratedAt)})
				</a>
			) : null}
			<Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={isPending}>
				{isPending ? <Loader2 className="animate-spin" /> : <FileDown />}
				{pdfPath ? `${label} erneuern` : label}
			</Button>
			{error ? <span className="text-xs text-destructive">{error}</span> : null}
		</div>
	);
}
