"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { saveTenantAction } from "@/app/(app)/mieter/actions";
import type { Tenant } from "@/data/types";

export function TenantFormDialog({ tenant }: { tenant?: Tenant }) {
	const { t } = useI18n();
	const isEdit = Boolean(tenant);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveTenantAction, initialActionState);

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
						{t("tenants.dialog.createTitle")}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? t("tenants.dialog.editTitle") : t("tenants.dialog.createTitle")}</DialogTitle>
						<DialogDescription>{t("tenants.dialog.description")}</DialogDescription>
					</DialogHeader>

					{isEdit ? <input type="hidden" name="id" value={tenant!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="firstName">{t("common.firstName")} *</Label>
								<Input id="firstName" name="firstName" defaultValue={tenant?.firstName} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="lastName">{t("common.lastName")} *</Label>
								<Input id="lastName" name="lastName" defaultValue={tenant?.lastName} required />
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="email">{t("common.email")}</Label>
							<Input id="email" name="email" type="email" defaultValue={tenant?.email ?? ""} />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="phone">{t("common.phone")}</Label>
							<Input id="phone" name="phone" defaultValue={tenant?.phone ?? ""} />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="notes">{t("common.notes")}</Label>
							<Textarea id="notes" name="notes" defaultValue={tenant?.notes ?? ""} />
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
