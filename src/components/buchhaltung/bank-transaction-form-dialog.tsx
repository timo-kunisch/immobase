"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { saveBankTransactionAction } from "@/app/(app)/buchhaltung/actions";

export function BankTransactionFormDialog({ propertyId }: { propertyId: string }) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveBankTransactionAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state.success]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button type="button" size="sm" variant="outline">
					<Plus />
					{t("banking.transactionDialog.trigger")}
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{t("banking.transactionDialog.createTitle")}</DialogTitle>
						<DialogDescription>{t("banking.transactionDialog.description")}</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="propertyId" value={propertyId} />

					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="bookingDate">{t("banking.fields.bookingDate")} *</Label>
								<Input id="bookingDate" name="bookingDate" type="date" required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="direction">{t("banking.fields.direction")} *</Label>
								<Select name="direction" defaultValue="INCOME" required>
									<SelectTrigger id="direction" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="INCOME">{t("banking.direction.INCOME")}</SelectItem>
										<SelectItem value="EXPENSE">{t("banking.direction.EXPENSE")}</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="amount">{t("common.amount")} *</Label>
							<Input id="amount" name="amount" type="number" step="0.01" min="0" required />
						</div>

						<div className="grid gap-2">
							<Label htmlFor="description">{t("banking.fields.description")} *</Label>
							<Input id="description" name="description" placeholder={t("banking.fields.descriptionPlaceholder")} required />
						</div>

						<div className="grid gap-2">
							<Label htmlFor="partner">{t("banking.fields.partner")}</Label>
							<Input id="partner" name="partner" placeholder={t("banking.fields.partnerPlaceholder")} />
						</div>

						<div className="grid gap-2">
							<Label htmlFor="notes">{t("common.notes")}</Label>
							<Textarea id="notes" name="notes" />
						</div>

						{state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
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

export function EditBankTransactionDialog({
	transaction,
	propertyId,
}: {
	transaction: { id: string; bookingDate: string; amount: string; description: string; partner: string | null; notes: string | null };
	propertyId: string;
}) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveBankTransactionAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state.success]);

	const direction = Number(transaction.amount) < 0 ? "EXPENSE" : "INCOME";
	const absoluteAmount = String(Math.abs(Number(transaction.amount)));

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="ghost" size="icon-sm" aria-label={t("common.edit")} title={t("common.edit")}>
					<Pencil className="size-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{t("banking.transactionDialog.editTitle")}</DialogTitle>
						<DialogDescription>{t("banking.transactionDialog.description")}</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="id" value={transaction.id} />
					<input type="hidden" name="propertyId" value={propertyId} />

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor={`bookingDate-${transaction.id}`}>{t("banking.fields.bookingDate")} *</Label>
							<Input
								id={`bookingDate-${transaction.id}`}
								name="bookingDate"
								type="date"
								defaultValue={transaction.bookingDate.slice(0, 10)}
								required
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor={`direction-${transaction.id}`}>{t("banking.fields.direction")}</Label>
								<Select name="direction" defaultValue={direction} required>
									<SelectTrigger id={`direction-${transaction.id}`} className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="INCOME">{t("banking.direction.INCOME")}</SelectItem>
										<SelectItem value="EXPENSE">{t("banking.direction.EXPENSE")}</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<Label htmlFor={`amount-${transaction.id}`}>{t("common.amount")} *</Label>
								<Input id={`amount-${transaction.id}`} name="amount" type="number" step="0.01" min="0" defaultValue={absoluteAmount} required />
							</div>
						</div>

						<div className="grid gap-2">
							<Label htmlFor={`description-${transaction.id}`}>{t("banking.fields.description")} *</Label>
							<Input id={`description-${transaction.id}`} name="description" defaultValue={transaction.description} required />
						</div>

						<div className="grid gap-2">
							<Label htmlFor={`partner-${transaction.id}`}>{t("banking.fields.partner")}</Label>
							<Input id={`partner-${transaction.id}`} name="partner" defaultValue={transaction.partner ?? ""} />
						</div>

						<div className="grid gap-2">
							<Label htmlFor={`notes-${transaction.id}`}>{t("common.notes")}</Label>
							<Textarea id={`notes-${transaction.id}`} name="notes" defaultValue={transaction.notes ?? ""} />
						</div>

						{state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
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
