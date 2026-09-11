"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { saveTicketAction } from "@/app/(app)/tickets/actions";
import type { Property, Ticket, Unit } from "@/data/types";

const statuses = ["OPEN", "IN_PROGRESS", "DONE"] as const;

export function TicketFormDialog({
	ticket,
	properties,
	units,
	defaultPropertyId,
}: {
	ticket?: Ticket;
	properties: Property[];
	units: Unit[];
	defaultPropertyId?: string;
}) {
	const { t } = useI18n();
	const isEdit = Boolean(ticket);
	const [open, setOpen] = useState(false);
	const [propertyId, setPropertyId] = useState(ticket ? (ticket.propertyId ?? "none") : (defaultPropertyId ?? properties[0]?.id ?? "none"));
	const [state, formAction, isPending] = useActionState(saveTicketAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state]);

	const filteredUnits = useMemo(() => units.filter((unit) => unit.propertyId === propertyId), [units, propertyId]);

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
						{t("tickets.actions.new")}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? t("tickets.dialog.editTitle") : t("tickets.actions.new")}</DialogTitle>
						<DialogDescription>{t("tickets.dialog.formDescription")}</DialogDescription>
					</DialogHeader>

					{isEdit ? <input type="hidden" name="id" value={ticket!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
<Label htmlFor="propertyId">{t("common.property")} ({t("common.optional")})</Label>
							<SearchableSelect
								name="propertyId"
								id="propertyId"
								value={propertyId}
								onValueChange={setPropertyId}
								options={[
									{ value: "none", label: t("tickets.fields.noProperty") },
									...properties.map((property) => ({ value: property.id, label: property.name })),
								]}
								placeholder={t("tickets.fields.propertyPlaceholder")}
							/>
							</div>
							<div className="grid gap-2">
<Label htmlFor="unitId">{t("common.unit")} ({t("common.optional")})</Label>
							<SearchableSelect
								key={propertyId}
								name="unitId"
								id="unitId"
								defaultValue={ticket?.unitId ?? "none"}
								options={[
									{ value: "none", label: t("tickets.fields.noUnit") },
									...filteredUnits.map((unit) => ({ value: unit.id, label: unit.label })),
								]}
								placeholder={t("tickets.fields.noUnit")}
							/>
							</div>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="title">{t("tickets.fields.title")} *</Label>
							<Input id="title" name="title" placeholder={t("tickets.fields.titlePlaceholder")} defaultValue={ticket?.title} required />
						</div>

						<div className="grid gap-2">
							<Label htmlFor="description">{t("common.description")}</Label>
							<Textarea id="description" name="description" placeholder={t("tickets.fields.descriptionPlaceholder")} defaultValue={ticket?.description ?? ""} />
						</div>

						<div className="grid gap-2">
							<Label htmlFor="status">{t("common.status")}</Label>
							<Select name="status" defaultValue={ticket?.status ?? "OPEN"}>
								<SelectTrigger id="status" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{statuses.map((value) => (
										<SelectItem key={value} value={value}>
											{t(`tickets.status.${value}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{isEdit ? (
							<div className="grid gap-2">
								<Label htmlFor="contractorNotes">{t("tickets.fields.contractorNotes")}</Label>
								<Textarea id="contractorNotes" name="contractorNotes" placeholder={t("tickets.fields.contractorNotesPlaceholder")} defaultValue={ticket?.contractorNotes ?? ""} />
							</div>
						) : null}

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
