"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, StickyNote } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { updateAnnualStatementNotesAction } from "@/app/(app)/weg/jahresabrechnung/actions";
import type { AnnualStatement } from "@/data/types";

/**
 * Notizen einer Jahresabrechnung erfassen/bearbeiten - bewusst jederzeit
 * möglich, auch nach der Finalisierung (Notizen sind interne Anmerkungen,
 * keine Abrechnungsdaten; Zeitraum/Kostenpositionen bleiben gesperrt).
 * Muster: BillingPeriodNotesDialog der Mietverwaltung - der frühere Bug
 * „Notizen nach der Finalisierung nicht mehr bearbeitbar" existiert hier
 * damit bewusst nicht.
 */
export function AnnualStatementNotesDialog({ statement }: { statement: AnnualStatement }) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(updateAnnualStatementNotesAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state.success]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					<StickyNote />
					{t("hoaStatement.notesDialog.trigger")}
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{t("hoaStatement.notesDialog.title")}</DialogTitle>
						<DialogDescription>{t("hoaStatement.notesDialog.description")}</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="id" value={statement.id} />

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="notes">{t("common.notes")}</Label>
							<Textarea id="notes" name="notes" placeholder={t("hoaStatement.fields.notesPlaceholder")} defaultValue={statement.notes ?? ""} />
						</div>
						<ActionErrorToast state={state} />
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							{t("common.cancel")}
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending ? <Loader2 className="animate-spin" /> : null}
							{t("common.save")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}