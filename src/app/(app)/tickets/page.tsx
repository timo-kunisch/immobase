import Link from "next/link";
import { Wrench } from "lucide-react";

import { getUnitWithPropertyName, listTickets, listUnitsByLabel } from "@/data/tickets";
import { getProperty, listProperties } from "@/data/properties";
import type { TicketStatus } from "@/data/types";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { TicketFormDialog } from "@/components/tickets/ticket-form-dialog";
import { TicketStatusSelect } from "@/components/tickets/ticket-status-select";
import { formatDate } from "@/lib/format";

import { deleteTicketAction } from "./actions";

export const dynamic = "force-dynamic";

const columns: { status: TicketStatus; title: string }[] = [
	{ status: "OPEN", title: "Offen" },
	{ status: "IN_PROGRESS", title: "In Bearbeitung" },
	{ status: "DONE", title: "Erledigt" },
];

export default async function TicketsPage({ searchParams }: { searchParams: Promise<{ propertyId?: string; unitId?: string }> }) {
	const { propertyId, unitId } = await searchParams;

	const ticketList = listTickets({ propertyId, unitId });
	// Picker-Listen alphabetisch (bisher: SQL ORDER BY name/label ASC).
	const propertyList = listProperties().sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
	const unitList = listUnitsByLabel();
	const filteredProperty = propertyId ? getProperty(propertyId) : null;
	const filteredUnit = unitId ? getUnitWithPropertyName(unitId) : null;

	const filterLabel = filteredUnit ? `${filteredUnit.propertyName} – ${filteredUnit.label}` : filteredProperty ? filteredProperty.name : null;

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title="Tickets" description="Schäden & Instandhaltung je Liegenschaft/Einheit." actions={<TicketFormDialog properties={propertyList} units={unitList} />} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				{propertyList.length === 0 ? <p className="text-sm text-muted-foreground">Legen Sie zuerst eine Liegenschaft an, um Tickets erfassen zu können.</p> : null}

				{filterLabel ? (
					<p className="text-sm text-muted-foreground">
						Gefiltert nach: <span className="font-medium text-foreground">{filterLabel}</span> ·{" "}
						<Link href="/tickets" className="text-primary hover:underline">
							Filter zurücksetzen
						</Link>
					</p>
				) : null}

				{ticketList.length === 0 ? (
					<Card>
						<CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
							<Wrench className="size-8" />
							<p>Noch keine Tickets erfasst.</p>
						</CardContent>
					</Card>
				) : (
					<div className="grid gap-4 lg:grid-cols-3">
						{columns.map((column) => {
							const columnTickets = ticketList.filter((ticket) => ticket.status === column.status);
							return (
								<div key={column.status} className="flex flex-col gap-3">
									<div className="flex items-center justify-between px-1">
										<h2 className="text-sm font-semibold text-muted-foreground">{column.title}</h2>
										<Badge variant="secondary">{columnTickets.length}</Badge>
									</div>

									<div className="flex flex-col gap-3">
										{columnTickets.length === 0 ? (
											<div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">Keine Tickets</div>
										) : (
											columnTickets.map((ticket) => (
												<Card key={ticket.id}>
													<CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
														<CardTitle className="text-sm font-medium leading-snug">{ticket.title}</CardTitle>
														<div className="flex items-center gap-0.5">
															<TicketFormDialog ticket={ticket} properties={propertyList} units={unitList} />
															<ConfirmDeleteButton action={deleteTicketAction.bind(null, ticket.id)} confirmMessage={`Ticket "${ticket.title}" wirklich löschen?`} />
														</div>
													</CardHeader>
													<CardContent className="flex flex-col gap-3">
														<p className="text-xs text-muted-foreground">
															<Link href={`/liegenschaften#property-${ticket.propertyId}`} className="hover:text-foreground hover:underline">
																{ticket.property.name}
															</Link>
															{ticket.unit ? (
																<>
																	{" · "}
																	<Link href={`/einheiten#unit-${ticket.unit.id}`} className="hover:text-foreground hover:underline">
																		{ticket.unit.label}
																	</Link>
																</>
															) : null}
														</p>
														{ticket.description ? <p className="text-sm text-muted-foreground line-clamp-3">{ticket.description}</p> : null}
														{ticket.contractorNotes ? (
															<p className="rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">
																<span className="font-medium">Handwerker: </span>
																{ticket.contractorNotes}
															</p>
														) : null}
														<div className="flex items-center justify-between gap-2">
															<span className="text-xs text-muted-foreground">{formatDate(ticket.createdAt)}</span>
															<div className="w-36">
																<TicketStatusSelect ticketId={ticket.id} status={ticket.status} />
															</div>
														</div>
													</CardContent>
												</Card>
											))
										)}
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
