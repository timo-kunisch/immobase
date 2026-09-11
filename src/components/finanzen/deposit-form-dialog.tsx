"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, PiggyBank } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/action-state";
import { toDateInputValue } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

import { saveDepositAction } from "@/app/(app)/finanzen/actions";
import type { Deposit, DepositStatus, DepositType } from "@/data/types";

const DEPOSIT_TYPES: DepositType[] = ["CASH", "BANK_GUARANTEE", "BLOCKED_ACCOUNT"];
const DEPOSIT_STATUSES: DepositStatus[] = ["PENDING", "RECEIVED", "PARTIALLY_REFUNDED", "REFUNDED"];

export function DepositFormDialog({ leaseId, leaseLabel, deposit, suggestedAmount }: { leaseId: string; leaseLabel: string; deposit?: Deposit; suggestedAmount?: string }) {
	const { t } = useI18n();
	const isEdit = Boolean(deposit);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveDepositAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{isEdit ? (
					<Button variant="ghost" size="icon-sm" aria-label={t("common.edit")} title={t("common.edit")}>
						<Pencil className="size-4" />
					</Button>
				) : (
					<Button type="button" variant="outline" size="sm">
						<PiggyBank />
						{t("finances.depositDialog.trigger")}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{t("finances.depositDialog.title")}</DialogTitle>
						<DialogDescription>{leaseLabel}</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="leaseId" value={leaseId} />

					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="type">{t("finances.fields.type")}</Label>
								<Select name="type" defaultValue={deposit?.type ?? "CASH"}>
									<SelectTrigger id="type" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{DEPOSIT_TYPES.map((value) => (
											<SelectItem key={value} value={value}>
												{t(`finances.depositType.${value}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="amount">{t("finances.fields.amount")} *</Label>
								<Input id="amount" name="amount" type="number" step="0.01" min="0" defaultValue={deposit?.amount ?? suggestedAmount ?? ""} required />
							</div>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="status">{t("common.status")}</Label>
							<Select name="status" defaultValue={deposit?.status ?? "PENDING"}>
								<SelectTrigger id="status" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{DEPOSIT_STATUSES.map((value) => (
										<SelectItem key={value} value={value}>
											{t(`finances.depositStatus.${value}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="receivedDate">{t("finances.fields.receivedDate")}</Label>
								<Input id="receivedDate" name="receivedDate" type="date" defaultValue={toDateInputValue(deposit?.receivedDate)} />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="refundedDate">{t("finances.fields.refundedDate")}</Label>
								<Input id="refundedDate" name="refundedDate" type="date" defaultValue={toDateInputValue(deposit?.refundedDate)} />
							</div>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="refundedAmount">{t("finances.fields.refundedAmount")}</Label>
							<Input id="refundedAmount" name="refundedAmount" type="number" step="0.01" min="0" defaultValue={deposit?.refundedAmount ?? ""} />
						</div>

						<div className="grid gap-2">
							<Label htmlFor="notes">{t("common.notes")}</Label>
							<Textarea id="notes" name="notes" defaultValue={deposit?.notes ?? ""} />
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
