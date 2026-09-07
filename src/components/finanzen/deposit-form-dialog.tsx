"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, PiggyBank } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/action-state";
import { toDateInputValue } from "@/lib/format";

import { saveDepositAction } from "@/app/(app)/finanzen/actions";
import type { Deposit } from "@/data/types";

const typeLabels: Record<string, string> = {
	CASH: "Barkaution",
	BANK_GUARANTEE: "Bankgarantie/Bürgschaft",
	BLOCKED_ACCOUNT: "Kautionskonto (Sparbuch)",
};

const statusLabels: Record<string, string> = {
	PENDING: "Ausstehend",
	RECEIVED: "Hinterlegt",
	PARTIALLY_REFUNDED: "Teilweise zurückgezahlt",
	REFUNDED: "Vollständig zurückgezahlt",
};

export function DepositFormDialog({ leaseId, leaseLabel, deposit, suggestedAmount }: { leaseId: string; leaseLabel: string; deposit?: Deposit; suggestedAmount?: string }) {
	const isEdit = Boolean(deposit);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveDepositAction, initialActionState);

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
					<Button type="button" variant="outline" size="sm">
						<PiggyBank />
						Kaution erfassen
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>Kautionskonto</DialogTitle>
						<DialogDescription>{leaseLabel}</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="leaseId" value={leaseId} />

					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="type">Art der Kaution</Label>
								<Select name="type" defaultValue={deposit?.type ?? "CASH"}>
									<SelectTrigger id="type" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{Object.entries(typeLabels).map(([value, label]) => (
											<SelectItem key={value} value={value}>
												{label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="amount">Betrag (€) *</Label>
								<Input id="amount" name="amount" type="number" step="0.01" min="0" defaultValue={deposit?.amount ?? suggestedAmount ?? ""} required />
							</div>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="status">Status</Label>
							<Select name="status" defaultValue={deposit?.status ?? "PENDING"}>
								<SelectTrigger id="status" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{Object.entries(statusLabels).map(([value, label]) => (
										<SelectItem key={value} value={value}>
											{label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="receivedDate">Hinterlegt am</Label>
								<Input id="receivedDate" name="receivedDate" type="date" defaultValue={toDateInputValue(deposit?.receivedDate)} />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="refundedDate">Zurückgezahlt am</Label>
								<Input id="refundedDate" name="refundedDate" type="date" defaultValue={toDateInputValue(deposit?.refundedDate)} />
							</div>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="refundedAmount">Zurückgezahlter Betrag (€)</Label>
							<Input id="refundedAmount" name="refundedAmount" type="number" step="0.01" min="0" defaultValue={deposit?.refundedAmount ?? ""} />
						</div>

						<div className="grid gap-2">
							<Label htmlFor="notes">Notizen</Label>
							<Textarea id="notes" name="notes" defaultValue={deposit?.notes ?? ""} />
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
