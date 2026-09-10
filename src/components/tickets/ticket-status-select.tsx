"use client";

import { useTransition } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/provider";
import { updateTicketStatusAction } from "@/app/(app)/tickets/actions";
import type { TicketStatus } from "@/data/types";

const statuses = ["OPEN", "IN_PROGRESS", "DONE"] as const;

export function TicketStatusSelect({ ticketId, status }: { ticketId: string; status: TicketStatus }) {
	const { t } = useI18n();
	const [isPending, startTransition] = useTransition();

	return (
		<Select
			value={status}
			disabled={isPending}
			onValueChange={(value) => {
				startTransition(() => {
					updateTicketStatusAction(ticketId, value as TicketStatus);
				});
			}}
		>
			<SelectTrigger size="sm" className="w-full">
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
	);
}
