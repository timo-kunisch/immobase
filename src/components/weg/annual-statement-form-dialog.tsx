"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState } from "@/lib/action-state";
import { toDateInputValue } from "@/lib/format";

import { saveAnnualStatementAction } from "@/app/(app)/weg/jahresabrechnung/actions";
import type { AnnualStatement } from "@/data/types";

export function AnnualStatementFormDialog({ hoaId, annualStatement }: { hoaId: string; annualStatement?: AnnualStatement }) {
	const isEdit = Boolean(annualStatement);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveAnnualStatementAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state.success]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{isEdit ? (
					<Button variant="ghost" size="icon-sm" aria-label="Bearbeiten" title="Bearbeiten">
						<Pencil className="size-4" />
					</Button>
				) : (
					<Button type="button">
						<Plus />
						Neue Jahresabrechnung
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? "Jahresabrechnung bearbeiten" : "Neue Jahresabrechnung"}</DialogTitle>
						<DialogDescription>Abrechnungszeitraum (i. d. R. ein Kalenderjahr) für die Hausgeldabrechnung.</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="hoaId" value={hoaId} />
					{isEdit ? <input type="hidden" name="id" value={annualStatement!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="periodFrom">Zeitraum von *</Label>
								<Input id="periodFrom" name="periodFrom" type="date" defaultValue={toDateInputValue(annualStatement?.periodFrom)} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="periodTo">Zeitraum bis *</Label>
								<Input id="periodTo" name="periodTo" type="date" defaultValue={toDateInputValue(annualStatement?.periodTo)} required />
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="notes">Notizen</Label>
							<Textarea id="notes" name="notes" defaultValue={annualStatement?.notes ?? ""} />
						</div>
						{state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							Abbrechen
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending ? <Loader2 className="animate-spin" /> : null}
							Speichern
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
