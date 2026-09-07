"use client";

import { useActionState, useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";

import { generateDueTransactionsAction } from "@/app/(app)/finanzen/actions";

function currentMonthValue(): string {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function GenerateDueTransactionsDialog() {
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(generateDueTransactionsAction, initialActionState);
	const defaultMonth = currentMonthValue();

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button type="button" variant="outline">
					<CalendarClock />
					Zahlungen für Zeitraum fällig stellen
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				{state.success ? (
					<>
						<DialogHeader>
							<DialogTitle>Fällig gestellt</DialogTitle>
							<DialogDescription>{state.message}</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<Button type="button" onClick={() => setOpen(false)}>
								Schließen
							</Button>
						</DialogFooter>
					</>
				) : (
					<form action={formAction}>
						<DialogHeader>
							<DialogTitle>Zahlungen automatisch fällig stellen</DialogTitle>
							<DialogDescription>
								Legt für alle aktiven Mietverträge und jeden Monat im gewählten Zeitraum eine offene Zahlung an (Kaltmiete + Nebenkosten). Bereits vorhandene Zahlungen für einen
								Monat werden nicht doppelt angelegt.
							</DialogDescription>
						</DialogHeader>

						<div className="grid gap-4 py-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="grid gap-2">
									<Label htmlFor="fromMonth">Von (Monat) *</Label>
									<Input id="fromMonth" name="fromMonth" type="month" defaultValue={defaultMonth} required />
								</div>
								<div className="grid gap-2">
									<Label htmlFor="toMonth">Bis (Monat) *</Label>
									<Input id="toMonth" name="toMonth" type="month" defaultValue={defaultMonth} required />
								</div>
							</div>

							<div className="grid gap-2">
								<Label htmlFor="dueDay">Fällig jeweils am (Tag des Monats) *</Label>
								<Input id="dueDay" name="dueDay" type="number" min="1" max="28" defaultValue="3" required />
								<p className="text-xs text-muted-foreground">Tag zwischen 1 und 28, um für jeden Monat ein gültiges Datum zu garantieren.</p>
							</div>

							{state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
						</div>

						<DialogFooter>
							<Button type="button" variant="outline" onClick={() => setOpen(false)}>
								Abbrechen
							</Button>
							<Button type="submit" disabled={isPending}>
								{isPending ? <Loader2 className="animate-spin" /> : null}
								Fällig stellen
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
