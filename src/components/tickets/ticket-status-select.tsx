"use client";

import { useTransition } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateTicketStatusAction } from "@/app/(app)/tickets/actions";
import type { TicketStatus } from "@/data/types";

const statusLabels: Record<string, string> = {
	OPEN: "Offen",
	IN_PROGRESS: "In Bearbeitung",
	DONE: "Erledigt",
};

export function TicketStatusSelect({ ticketId, status }: { ticketId: string; status: TicketStatus }) {
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
				{Object.entries(statusLabels).map(([value, label]) => (
					<SelectItem key={value} value={value}>
						{label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
