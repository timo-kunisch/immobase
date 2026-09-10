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
import { toDateInputValue } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

import { saveReserveFundBookingAction } from "@/app/(app)/weg/ruecklage/actions";
import type { ReserveFundBooking, ReserveFundBookingType } from "@/data/types";

export function ReserveFundBookingFormDialog({ hoaId, booking }: { hoaId: string; booking?: ReserveFundBooking }) {
	const { t } = useI18n();
	const isEdit = Boolean(booking);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveReserveFundBookingAction, initialActionState);

	const bookingTypeLabels: Record<string, string> = {
		CONTRIBUTION: t("hoaFinance.reserve.bookingType.CONTRIBUTION"),
		WITHDRAWAL: t("hoaFinance.reserve.bookingType.WITHDRAWAL"),
	};

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state.success]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{isEdit ? (
					<Button variant="ghost" size="icon-sm" aria-label={t("common.edit")} title={t("common.edit")}>
						<Pencil className="size-4" />
					</Button>
				) : (
					<Button type="button">
						<Plus />
						{t("hoaFinance.reserve.actions.create")}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? t("hoaFinance.reserve.dialog.editTitle") : t("hoaFinance.reserve.dialog.createTitle")}</DialogTitle>
						<DialogDescription>{t("hoaFinance.reserve.dialog.description")}</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="hoaId" value={hoaId} />
					{isEdit ? <input type="hidden" name="id" value={booking!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="type">{t("hoaFinance.reserve.fields.type")} *</Label>
							<Select name="type" defaultValue={booking?.type ?? ("CONTRIBUTION" satisfies ReserveFundBookingType)} required>
								<SelectTrigger id="type" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{Object.entries(bookingTypeLabels).map(([value, label]) => (
										<SelectItem key={value} value={value}>
											{label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="bookingDate">{t("common.date")} *</Label>
								<Input id="bookingDate" name="bookingDate" type="date" defaultValue={toDateInputValue(booking?.bookingDate)} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="amount">{t("hoaFinance.reserve.fields.amount")} *</Label>
								<Input id="amount" name="amount" type="number" step="0.01" min="0.01" defaultValue={booking?.amount} required />
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="description">{t("hoaFinance.reserve.fields.description")} *</Label>
							<Input id="description" name="description" placeholder={t("hoaFinance.reserve.placeholder.description")} defaultValue={booking?.description} required />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="notes">{t("common.notes")}</Label>
							<Textarea id="notes" name="notes" defaultValue={booking?.notes ?? ""} />
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
