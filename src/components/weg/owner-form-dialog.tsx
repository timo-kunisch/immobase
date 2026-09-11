"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { saveOwnerAction } from "@/app/(app)/weg/eigentuemer/actions";
import type { Owner } from "@/data/types";

export function OwnerFormDialog({ owner }: { owner?: Owner }) {
	const { t } = useI18n();
	const isEdit = Boolean(owner);
	const [open, setOpen] = useState(false);
	const [isCompany, setIsCompany] = useState(owner?.isCompany ?? false);
	const [state, formAction, isPending] = useActionState(saveOwnerAction, initialActionState);

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
					<Button type="button">
						<Plus />
						{t("hoa.owners.actions.create")}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? t("hoa.owners.dialog.editTitle") : t("hoa.owners.dialog.createTitle")}</DialogTitle>
						<DialogDescription>{t("hoa.owners.dialog.description")}</DialogDescription>
					</DialogHeader>

					{isEdit ? <input type="hidden" name="id" value={owner!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="flex items-center gap-2">
							<Switch id="isCompany" name="isCompany" checked={isCompany} onCheckedChange={setIsCompany} />
							<Label htmlFor="isCompany">{t("hoa.owners.fields.isCompany")}</Label>
						</div>

						{isCompany ? (
							<div className="grid gap-2">
								<Label htmlFor="companyName">{t("hoa.owners.fields.companyName")}</Label>
								<Input id="companyName" name="companyName" defaultValue={owner?.companyName ?? ""} />
							</div>
						) : null}

						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="firstName">{isCompany ? t("hoa.owners.fields.contactFirstName") : t("common.firstName")} *</Label>
								<Input id="firstName" name="firstName" defaultValue={owner?.firstName} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="lastName">{isCompany ? t("hoa.owners.fields.contactLastName") : t("common.lastName")} *</Label>
								<Input id="lastName" name="lastName" defaultValue={owner?.lastName} required />
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="street">{t("hoa.owners.fields.street")} *</Label>
							<Input id="street" name="street" defaultValue={owner?.street} required />
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="zipCode">{t("hoa.owners.fields.zipCode")} *</Label>
								<Input id="zipCode" name="zipCode" defaultValue={owner?.zipCode} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="city">{t("hoa.owners.fields.city")} *</Label>
								<Input id="city" name="city" defaultValue={owner?.city} required />
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="country">{t("hoa.owners.fields.country")}</Label>
							<Input id="country" name="country" defaultValue={owner?.country ?? "Deutschland"} />
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="email">{t("common.email")}</Label>
								<Input id="email" name="email" type="email" defaultValue={owner?.email ?? ""} />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="phone">{t("common.phone")}</Label>
								<Input id="phone" name="phone" defaultValue={owner?.phone ?? ""} />
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="notes">{t("common.notes")}</Label>
							<Textarea id="notes" name="notes" defaultValue={owner?.notes ?? ""} />
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
