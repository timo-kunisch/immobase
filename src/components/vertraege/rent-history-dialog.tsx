"use client";

import { useState } from "react";
import { History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { RentAdjustmentFormDialog } from "@/components/vertraege/rent-adjustment-form-dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { buildRentHistory } from "@/lib/rent-history";

import { deleteRentAdjustmentAction } from "@/app/(app)/vertraege/actions";
import type { Lease, RentAdjustment } from "@/data/types";

type LeaseRentFields = Pick<Lease, "id" | "startDate" | "coldRent" | "serviceCharges">;

export function RentHistoryDialog({ lease, adjustments, hasAdjustments }: { lease: LeaseRentFields; adjustments: RentAdjustment[]; hasAdjustments: boolean }) {
	const [open, setOpen] = useState(false);
	const history = buildRentHistory(lease, adjustments);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label="Verlauf der Miete/Nebenkosten"
					title={hasAdjustments ? "Verlauf der Miete/Nebenkosten" : "Miet-/Nebenkostenänderung hinterlegen"}
					className={hasAdjustments ? "text-primary" : undefined}
				>
					<History className="size-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Verlauf der vereinbarten Zahlungen</DialogTitle>
					<DialogDescription>Übersicht aller Kaltmiete-/Nebenkostenbeträge über die Mietdauer inkl. späterer Änderungen (z. B. Mieterhöhungen).</DialogDescription>
				</DialogHeader>

				<div className="max-h-[50vh] overflow-y-auto rounded-lg border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Gültig ab</TableHead>
								<TableHead>Gültig bis</TableHead>
								<TableHead className="text-right">Kaltmiete</TableHead>
								<TableHead className="text-right">Nebenkosten</TableHead>
								<TableHead>Notiz</TableHead>
								<TableHead className="w-[80px] text-right">Aktionen</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{history.map((period) => {
								const adjustment = adjustments.find((a) => a.id === period.adjustmentId);
								return (
									<TableRow key={period.adjustmentId ?? "initial"}>
										<TableCell className="whitespace-nowrap">{formatDate(period.validFrom)}</TableCell>
										<TableCell className="whitespace-nowrap text-muted-foreground">{period.validUntil ? formatDate(period.validUntil) : "laufend"}</TableCell>
										<TableCell className="text-right">{formatCurrency(period.coldRent)}</TableCell>
										<TableCell className="text-right">{formatCurrency(period.serviceCharges)}</TableCell>
										<TableCell className="text-muted-foreground">{period.notes ?? (period.adjustmentId ? "–" : "Ursprünglicher Vertragsbetrag")}</TableCell>
										<TableCell>
											{adjustment ? (
												<div className="flex items-center justify-end gap-1">
													<RentAdjustmentFormDialog leaseId={lease.id} adjustment={adjustment} />
													<ConfirmDeleteButton action={deleteRentAdjustmentAction.bind(null, adjustment.id)} confirmMessage="Diese Änderung wirklich löschen?" />
												</div>
											) : null}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</div>

				<DialogFooter className="items-center sm:justify-between">
					<RentAdjustmentFormDialog leaseId={lease.id} />
					<Button type="button" variant="outline" onClick={() => setOpen(false)}>
						Schließen
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
