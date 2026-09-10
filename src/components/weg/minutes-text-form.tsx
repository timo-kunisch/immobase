"use client";

import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { saveMinutesTextAction } from "@/app/(app)/weg/versammlungen/actions";

export function MinutesTextForm({ hoaId, meetingId, minutesText }: { hoaId: string; meetingId: string; minutesText: string | null }) {
	const { t } = useI18n();
	const [state, formAction, isPending] = useActionState(saveMinutesTextAction, initialActionState);

	return (
		<form action={formAction} className="space-y-3">
			<input type="hidden" name="hoaId" value={hoaId} />
			<input type="hidden" name="meetingId" value={meetingId} />
			<Textarea name="minutesText" className="min-h-48" placeholder={t("hoaMeetings.minutes.placeholder")} defaultValue={minutesText ?? ""} />
			{state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
			<div className="flex justify-end">
				<Button type="submit" size="sm" disabled={isPending}>
					{isPending ? <Loader2 className="animate-spin" /> : <Save />}
					{t("hoaMeetings.minutes.actions.save")}
				</Button>
			</div>
		</form>
	);
}
