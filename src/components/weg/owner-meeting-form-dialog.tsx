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

import { saveOwnerMeetingAction } from "@/app/(app)/weg/versammlungen/actions";
import type { OwnerMeeting } from "@/data/types";

function toDateTimeInputValue(value: string | null | undefined): string {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	const offset = date.getTimezoneOffset();
	const local = new Date(date.getTime() - offset * 60000);
	return local.toISOString().slice(0, 16);
}

export function OwnerMeetingFormDialog({ hoaId, meeting }: { hoaId: string; meeting?: OwnerMeeting }) {
	const { t } = useI18n();
	const isEdit = Boolean(meeting);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveOwnerMeetingAction, initialActionState);

	const meetingTypeLabels: Record<string, string> = {
		ORDINARY: t("hoaMeetings.meetingType.ORDINARY"),
		EXTRAORDINARY: t("hoaMeetings.meetingType.EXTRAORDINARY"),
		CIRCULATION: t("hoaMeetings.meetingType.CIRCULATION"),
	};
	const meetingStatusLabels: Record<string, string> = {
		PLANNED: t("hoaMeetings.meetingStatus.PLANNED"),
		INVITED: t("hoaMeetings.meetingStatus.INVITED"),
		HELD: t("hoaMeetings.meetingStatus.HELD"),
		MINUTES_FINALIZED: t("hoaMeetings.meetingStatus.MINUTES_FINALIZED"),
		CANCELLED: t("hoaMeetings.meetingStatus.CANCELLED"),
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
						{t("hoaMeetings.meetings.actions.create")}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? t("hoaMeetings.meetings.dialog.editTitle") : t("hoaMeetings.meetings.dialog.createTitle")}</DialogTitle>
						<DialogDescription>{t("hoaMeetings.meetings.dialog.description")}</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="hoaId" value={hoaId} />
					{isEdit ? <input type="hidden" name="id" value={meeting!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="title">{t("hoaMeetings.meetings.fields.title")} *</Label>
							<Input id="title" name="title" placeholder={t("hoaMeetings.meetings.placeholder.title")} defaultValue={meeting?.title} required />
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="type">{t("hoaMeetings.meetings.fields.type")}</Label>
								<Select name="type" defaultValue={meeting?.type ?? "ORDINARY"}>
									<SelectTrigger id="type" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{Object.entries(meetingTypeLabels).map(([value, label]) => (
											<SelectItem key={value} value={value}>
												{label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="status">{t("common.status")}</Label>
								<Select name="status" defaultValue={meeting?.status ?? "PLANNED"}>
									<SelectTrigger id="status" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{Object.entries(meetingStatusLabels).map(([value, label]) => (
											<SelectItem key={value} value={value}>
												{label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="meetingDate">{t("hoaMeetings.meetings.fields.meetingDate")}</Label>
								<Input id="meetingDate" name="meetingDate" type="datetime-local" defaultValue={toDateTimeInputValue(meeting?.meetingDate)} />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="location">{t("hoaMeetings.meetings.fields.location")}</Label>
								<Input id="location" name="location" placeholder={t("hoaMeetings.meetings.placeholder.location")} defaultValue={meeting?.location ?? ""} />
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="notes">{t("common.notes")}</Label>
							<Textarea id="notes" name="notes" defaultValue={meeting?.notes ?? ""} />
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
