"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Loader2, Wrench } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { convertMessageToTicketAction } from "@/app/(app)/postfach/actions";
import type { Property, TicketMessage, Unit } from "@/data/types";

/**
 * Wandelt eine Postfach-E-Mail in ein neues Ticket um (Betreff/Inhalt sind
 * als Titel/Beschreibung vorbefüllt).
 */
export function ConvertToTicketDialog({ message, properties, units }: { message: TicketMessage; properties: Property[]; units: Unit[] }) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "none");
	const [state, formAction, isPending] = useActionState(convertMessageToTicketAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state]);

	const filteredUnits = useMemo(() => units.filter((unit) => unit.propertyId === propertyId), [units, propertyId]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button type="button" variant="outline" size="sm">
					<Wrench className="size-4" />
					{t("tickets.mailbox.actions.convert")}
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{t("tickets.mailbox.dialog.convertTitle")}</DialogTitle>
						<DialogDescription>{t("tickets.mailbox.dialog.convertDescription")}</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="messageId" value={message.id} />

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
								defaultValue="none"
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
							<Input id="title" name="title" defaultValue={message.subject ?? ""} required />
						</div>

						<div className="grid gap-2">
							<Label htmlFor="description">{t("common.description")}</Label>
							{/* max-h begrenzt die mitwachsende Textarea (field-sizing-content), damit bei langen E-Mails die Dialog-Buttons erreichbar bleiben. */}
							<Textarea id="description" name="description" rows={8} defaultValue={message.bodyText ?? ""} className="max-h-64" />
						</div>

						<ActionErrorToast state={state} />
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							{t("common.cancel")}
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending ? <Loader2 className="animate-spin" /> : null}
							{t("tickets.mailbox.dialog.convertSubmit")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
