"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { saveHoaAction } from "@/app/(app)/weg/actions";
import type { Hoa, Property } from "@/data/types";

/**
 * Bewusst nur Liegenschaften anbieten, die noch keiner WEG zugeordnet sind
 * (1:1-Beziehung, siehe UNIQUE-Index auf hoas.property_id) - beim
 * Bearbeiten wird die aktuelle Liegenschaft der WEG selbst zusätzlich mit
 * angeboten (sonst wäre das Feld beim Bearbeiten leer, falls die
 * Liegenschaft aus der "freien" Liste bereits herausgefiltert wurde).
 */
export function HoaFormDialog({ hoa, availableProperties }: { hoa?: Hoa; availableProperties: Property[] }) {
	const { t } = useI18n();
	const isEdit = Boolean(hoa);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveHoaAction, initialActionState);

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
					<Button type="button" disabled={availableProperties.length === 0}>
						<Plus />
						{t("hoa.actions.create")}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? t("hoa.dialog.editTitle") : t("hoa.dialog.createTitle")}</DialogTitle>
						<DialogDescription>{t("hoa.dialog.description")}</DialogDescription>
					</DialogHeader>

					{isEdit ? <input type="hidden" name="id" value={hoa!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="propertyId">{t("common.property")} *</Label>
							<Select name="propertyId" defaultValue={hoa?.propertyId ?? availableProperties[0]?.id} required>
								<SelectTrigger id="propertyId" className="w-full">
									<SelectValue placeholder={t("hoa.placeholder.property")} />
								</SelectTrigger>
								<SelectContent>
									{availableProperties.map((property) => (
										<SelectItem key={property.id} value={property.id}>
											{property.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="name">{t("hoa.fields.name")} *</Label>
							<Input id="name" name="name" placeholder={t("hoa.placeholder.name")} defaultValue={hoa?.name} required />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="totalShares">{t("hoa.fields.totalShares")} *</Label>
							<Input id="totalShares" name="totalShares" type="number" step="0.01" min="0.01" defaultValue={hoa?.totalShares ?? 1000} required />
							<p className="text-xs text-muted-foreground">{t("hoa.fields.totalSharesHint")}</p>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="bankIban">{t("hoa.fields.bankIban")}</Label>
								<Input id="bankIban" name="bankIban" placeholder={t("hoa.placeholder.bankIban")} defaultValue={hoa?.bankIban ?? ""} />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="bankBic">{t("hoa.fields.bankBic")}</Label>
								<Input id="bankBic" name="bankBic" defaultValue={hoa?.bankBic ?? ""} />
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="notes">{t("common.notes")}</Label>
							<Textarea id="notes" name="notes" placeholder={t("hoa.placeholder.notes")} defaultValue={hoa?.notes ?? ""} />
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
